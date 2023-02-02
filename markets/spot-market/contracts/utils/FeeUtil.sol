//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/FeeConfiguration.sol";

library FeeUtil {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using DecimalMath for int256;

    /**
     * @dev Calculates fees then runs the fees through a fee collector before returning the computed data.
     */
    function processFees(
        uint128 marketId,
        address transactor,
        uint256 usdAmount,
        SpotMarketFactory.TransactionType transactionType
    ) internal returns (uint256 amountUsable, int256 totalFees, uint collectedFees) {
        (amountUsable, totalFees) = calculateFees(marketId, transactor, usdAmount, transactionType);

        if (totalFees > 0) {
            collectedFees = collectFees(marketId, totalFees.toUint(), transactor, transactionType);
        }
    }

    /**
     * @dev Calculates fees for a given transaction type.
     */
    function calculateFees(
        uint128 marketId,
        address transactor,
        uint256 usdAmount,
        SpotMarketFactory.TransactionType transactionType
    ) internal returns (uint256 amountUsable, int256 feesCollected) {
        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(marketId);

        if (
            transactionType == SpotMarketFactory.TransactionType.BUY ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_BUY
        ) {
            (amountUsable, feesCollected) = calculateBuyFees(
                feeConfiguration,
                transactor,
                marketId,
                usdAmount,
                transactionType == SpotMarketFactory.TransactionType.ASYNC_BUY
            );
        } else if (
            transactionType == SpotMarketFactory.TransactionType.SELL ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_SELL
        ) {
            (amountUsable, feesCollected) = calculateSellFees(
                feeConfiguration,
                transactor,
                marketId,
                usdAmount,
                transactionType == SpotMarketFactory.TransactionType.ASYNC_SELL
            );
        } else if (transactionType == SpotMarketFactory.TransactionType.WRAP) {
            (amountUsable, feesCollected) = calculateWrapFees(feeConfiguration, usdAmount);
        } else if (transactionType == SpotMarketFactory.TransactionType.UNWRAP) {
            (amountUsable, feesCollected) = calculateUnwrapFees(feeConfiguration, usdAmount);
        } else {
            amountUsable = usdAmount;
            feesCollected = 0;
        }
    }

    /**
     * @dev Calculates wrap fees based on the wrapFixedFee.
     */
    function calculateWrapFees(
        FeeConfiguration.Data storage feeConfiguration,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        (amountUsable, feesCollected) = _applyFees(amount, feeConfiguration.wrapFixedFee);
    }

    /**
     * @dev Calculates wrap fees based on the unwrapFixedFee.
     */
    function calculateUnwrapFees(
        FeeConfiguration.Data storage feeConfiguration,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        (amountUsable, feesCollected) = _applyFees(amount, feeConfiguration.unwrapFixedFee);
    }

    /**
     * @dev Calculates fees for a buy transaction.
     *
     * Fees are calculated as follows:
     *
     * 1. Utilization fee (bips):  The utilization fee is a fee that's applied based on the ratio of delegated collateral to total outstanding synth exposure.
     * 2. Skew fee (bips): The skew fee is a fee that's applied based on the ratio of outstanding synths to the skew scale.
     * 3. Fixed fee (bips): The fixed fee is a fee that's applied to every transaction.
     */
    function calculateBuyFees(
        FeeConfiguration.Data storage feeConfiguration,
        address transactor,
        uint128 marketId,
        uint256 amount,
        bool async
    ) internal returns (uint amountUsable, int feesCollected) {
        uint utilizationFee = calculateUtilizationRateFee(
            feeConfiguration,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.BUY
        );

        int skewFee = calculateSkewFee(
            feeConfiguration,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.BUY
        );

        uint fixedFee = _getAtomicFixedFee(feeConfiguration, transactor);

        int totalFees = utilizationFee.toInt() + skewFee + fixedFee.toInt();

        (amountUsable, feesCollected) = _applyFees(amount, totalFees);
    }

    /**
     * @dev Calculates fees for a sell transaction.
     *
     * Fees are calculated as follows:
     *
     * 1. Skew fee (bips): The skew fee is a fee that's applied based on the ratio of outstanding synths to the skew scale.
     *    When a sell trade is executed, the skew fee is applied as a negative value to create incentive to bring market to equilibrium.
     * 3. Fixed fee (bips): The fixed fee is a fee that's applied to every transaction.
     */
    function calculateSellFees(
        FeeConfiguration.Data storage feeConfiguration,
        address transactor,
        uint128 marketId,
        uint256 amount,
        bool async
    ) internal returns (uint amountUsable, int feesCollected) {
        int skewFee = calculateSkewFee(
            feeConfiguration,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.SELL
        );

        uint fixedFee = _getAtomicFixedFee(feeConfiguration, transactor);
        int totalFees = skewFee + fixedFee.toInt();

        (amountUsable, feesCollected) = _applyFees(amount, totalFees);
    }

    /**
     * @dev Calculates skew fee
     *
     * If no skewScale is set, then the fee is 0
     * The skew fee is determined based on the ratio of outstanding synth value to the skew scale value.
     * Example:
     *  Skew scale set to 1000 snxETH
     *  Before fill outstanding snxETH (minus any wrapped collateral): 100 snxETH
     *  If buy trade:
     *    - user is buying 10 ETH
     *    - skew fee = (100 / 1000 + 110 / 1000) / 2 = 0.105 = 10.5% = 1005 bips
     * sell trade would be the same, except -10.5% fee would be applied incentivizing user to sell which brings market closer to 0 skew.
     */
    function calculateSkewFee(
        FeeConfiguration.Data storage feeConfiguration,
        uint128 marketId,
        uint amount,
        SpotMarketFactory.TransactionType transactionType
    ) internal returns (int skewFee) {
        if (feeConfiguration.skewScale == 0) {
            return 0;
        }

        bool isBuyTrade = transactionType == SpotMarketFactory.TransactionType.BUY ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_BUY;
        bool isSellTrade = transactionType == SpotMarketFactory.TransactionType.SELL ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_SELL;

        if (!isBuyTrade && !isSellTrade) {
            return 0;
        }

        uint collateralPrice = Price.getCurrentPrice(marketId, transactionType);

        uint skewScaleValue = feeConfiguration.skewScale.mulDecimal(collateralPrice);

        uint totalSynthValue = (SynthUtil
            .getToken(marketId)
            .totalSupply()
            .mulDecimal(collateralPrice)
            .toInt() + AsyncOrder.load(marketId).totalCommittedUsdAmount).toUint(); // add async order commitment amount in escrow

        Wrapper.Data storage wrapper = Wrapper.load(marketId);
        uint wrappedMarketCollateral = IMarketCollateralModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateralAmount(marketId, wrapper.wrapCollateralType)
            .mulDecimal(collateralPrice);

        uint initialSkew = totalSynthValue - wrappedMarketCollateral;
        uint initialSkewAdjustment = initialSkew.divDecimal(skewScaleValue);

        uint skewAfterFill = initialSkew;
        if (isBuyTrade) {
            skewAfterFill += amount;
        } else if (isSellTrade) {
            skewAfterFill -= amount;
        }

        uint skewAfterFillAdjustment = skewAfterFill.divDecimal(skewScaleValue);
        int skewAdjustmentAveragePercentage = (skewAfterFillAdjustment.toInt() +
            initialSkewAdjustment.toInt()) / 2;

        skewFee = isSellTrade
            ? skewAdjustmentAveragePercentage * -1
            : skewAdjustmentAveragePercentage;
    }

    /**
     * @dev Calculates utilization rate fee
     *
     * If no utilizationFeeRate is set, then the fee is 0
     * The utilization rate fee is determined based on the ratio of outstanding synth value to the delegated collateral to the market.
     * Example:
     *  Utilization fee rate set to 0.1%
     *  Total delegated collateral value: $1000
     *  Total outstanding synth value = $1100
     *  User buys $100 worth of synths
     *  Before fill utilization rate: 1100 / 1000 = 110%
     *  After fill utilization rate: 1200 / 1000 = 120%
     *  Utilization Rate Delta = 120 - 110 = 10% delta
     *  Fee charged = 10 * 0.001 (0.1%)  = 1%
     *
     */
    function calculateUtilizationRateFee(
        FeeConfiguration.Data storage feeConfiguration,
        uint128 marketId,
        uint amount,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint utilFee) {
        if (feeConfiguration.utilizationFeeRate == 0) {
            return 0;
        }

        uint delegatedCollateral = IMarketManagerModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateral(marketId);

        uint totalBalance = (SynthUtil.getToken(marketId).totalSupply().toInt() +
            AsyncOrder.load(marketId).totalCommittedUsdAmount).toUint();

        uint totalValueBeforeFill = totalBalance.mulDecimal(
            Price.getCurrentPrice(marketId, transactionType)
        );
        uint totalValueAfterFill = totalValueBeforeFill + amount;

        // utilization is below 100%
        if (delegatedCollateral > totalValueAfterFill) {
            return 0;
        } else {
            uint preUtilization = totalValueBeforeFill.divDecimal(delegatedCollateral);
            // use 100% utilization if pre-fill utilization was less than 100%
            // no fees charged below 100% utilization
            uint preUtilizationDelta = preUtilization > 1e18 ? preUtilization - 1e18 : 0;
            uint postUtilization = totalValueAfterFill.divDecimal(delegatedCollateral);
            uint postUtilizationDelta = postUtilization - 1e18;

            // utilization is represented as the # of percentage points above 100%
            uint utilization = (preUtilizationDelta + postUtilizationDelta).mulDecimal(100e18) / 2;

            utilFee = utilization.mulDecimal(feeConfiguration.utilizationFeeRate);
        }
    }

    /**
     * @dev Runs the calculated fees through the Fee collector if it exists.
     *
     * The rest of the fees not collected by fee collector is deposited into the market manager
     * If no fee collector is specified, all fees are deposited into the market manager to help staker c-ratios.
     *
     */
    function collectFees(
        uint128 marketId,
        uint totalFees,
        address transactor,
        SpotMarketFactory.TransactionType transactionType
    ) internal returns (uint collectedFees) {
        IFeeCollector feeCollector = FeeConfiguration.load(marketId).feeCollector;
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();

        if (address(feeCollector) != address(0)) {
            uint previousUsdBalance = spotMarketFactory.usdToken.balanceOf(address(this));

            spotMarketFactory.usdToken.approve(address(feeCollector), totalFees);
            feeCollector.collectFees(marketId, totalFees, transactor, uint8(transactionType));

            uint currentUsdBalance = spotMarketFactory.usdToken.balanceOf(address(this));
            collectedFees = previousUsdBalance - currentUsdBalance;

            spotMarketFactory.usdToken.approve(address(feeCollector), 0);
        }

        uint feesToDeposit = totalFees - collectedFees;
        spotMarketFactory.depositToMarketManager(marketId, feesToDeposit);
    }

    function _applyFees(
        uint amount,
        int fees // 18 decimals
    ) private pure returns (uint amountUsable, int feesCollected) {
        feesCollected = fees.mulDecimal(amount.toInt());
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    function _getAtomicFixedFee(
        FeeConfiguration.Data storage feeConfiguration,
        address transactor
    ) private view returns (uint) {
        // TODO: add to readme, can't set transactor's value to zero
        // talk to afif
        return
            feeConfiguration.atomicFixedFeeOverrides[transactor] > 0
                ? feeConfiguration.atomicFixedFeeOverrides[transactor]
                : feeConfiguration.atomicFixedFee;
    }
}
