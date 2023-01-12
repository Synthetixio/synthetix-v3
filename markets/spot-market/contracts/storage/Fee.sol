//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../utils/SynthUtil.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/external/IFeeCollector.sol";
import "./Price.sol";
import "./Wrapper.sol";
import "./AsyncOrderConfiguration.sol";

/**
 * @title Fee storage that tracks all fees for a given market Id.
 */
library Fee {
    using DecimalMath for uint256;
    using DecimalMath for int256;
    using Price for Price.Data;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    struct Data {
        /**
         * @dev The atomic fixed fee rate for a specific transactor.  Useful for direct integrations to set custom fees for specific addresses.
         */
        mapping(address => uint) atomicFixedFeeOverrides;
        /**
         * @dev atomic buy/sell fixed fee that's applied on all trades. In Bips, 18 decimals
         */
        uint atomicFixedFee;
        uint asyncFixedFee;
        /**
         * @dev utilization fee rate in Bips is the rate of fees applied based on the ratio of delegated collateral to total outstanding synth exposure. 18 decimals
         * applied on buy trades only.
         */
        uint utilizationFeeRate;
        /**
         * @dev wrapping fee rate in bips, 18 decimals
         */
        int wrapFixedFee;
        /**
         * @dev unwrapping fee rate in bips, 18 decimals
         */
        int unwrapFixedFee;
        /**
         * @dev skewScale is used to determine % of fees that get applied based on the ratio of outsanding synths to skewScale.
         * if outstanding synths = skew scale, then 100% premium is applied to the trade.
         * A negative skew, derived based on the mentioned ratio, is applied on sell trades
         */
        uint skewScale;
        /**
         * @dev The fee collector gets sent the calculated fees and can keep some of them to distribute in whichever way it wants.
         * The rest of the fees are deposited into the market manager.
         */
        IFeeCollector feeCollector;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            store.slot := s
        }
    }

    /**
     * @dev Set custom fee for transactor
     */
    function setAtomicFixedFeeOverride(
        uint128 marketId,
        address transactor,
        uint fixedFee
    ) internal {
        load(marketId).atomicFixedFeeOverrides[transactor] = fixedFee;
    }

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

        // TODO: negative fees are ignored.  Verify this.
        if (totalFees > 0) {
            collectedFees = collectFees(marketId, totalFees.toUint());
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
        Data storage self = load(marketId);

        if (
            transactionType == SpotMarketFactory.TransactionType.BUY ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_BUY
        ) {
            (amountUsable, feesCollected) = calculateBuyFees(
                self,
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
                self,
                transactor,
                marketId,
                usdAmount,
                transactionType == SpotMarketFactory.TransactionType.ASYNC_SELL
            );
        } else if (transactionType == SpotMarketFactory.TransactionType.WRAP) {
            (amountUsable, feesCollected) = calculateWrapFees(self, usdAmount);
        } else if (transactionType == SpotMarketFactory.TransactionType.UNWRAP) {
            (amountUsable, feesCollected) = calculateUnwrapFees(self, usdAmount);
        } else {
            amountUsable = usdAmount;
            feesCollected = 0;
        }
    }

    /**
     * @dev Calculates wrap fees based on the wrapFixedFee.
     */
    function calculateWrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        (amountUsable, feesCollected) = _applyFees(amount, self.wrapFixedFee);
    }

    /**
     * @dev Calculates wrap fees based on the unwrapFixedFee.
     */
    function calculateUnwrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        (amountUsable, feesCollected) = _applyFees(amount, self.unwrapFixedFee);
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
        Data storage self,
        address transactor,
        uint128 marketId,
        uint256 amount,
        bool async
    ) internal returns (uint amountUsable, int feesCollected) {
        uint utilizationFee = calculateUtilizationRateFee(
            self,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.BUY
        );

        int skewFee = calculateSkewFee(
            self,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.BUY
        );

        uint fixedFee = async ? self.asyncFixedFee : _getAtomicFixedFee(self, transactor);

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
        Data storage self,
        address transactor,
        uint128 marketId,
        uint256 amount,
        bool async
    ) internal returns (uint amountUsable, int feesCollected) {
        int skewFee = calculateSkewFee(
            self,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.SELL
        );

        uint fixedFee = async ? self.asyncFixedFee : _getAtomicFixedFee(self, transactor);
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
        Data storage self,
        uint128 marketId,
        uint amount,
        SpotMarketFactory.TransactionType transactionType
    ) internal returns (int skewFee) {
        if (self.skewScale == 0) {
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

        uint skewScaleValue = self.skewScale.mulDecimal(collateralPrice);

        uint totalSynthValue = SynthUtil.getToken(marketId).totalSupply().mulDecimal(
            collateralPrice
        );

        Wrapper.Data storage wrapper = Wrapper.load(marketId);
        uint wrappedMarketCollateral = 0;
        if (wrapper.wrappingEnabled) {
            wrappedMarketCollateral = IMarketCollateralModule(SpotMarketFactory.load().synthetix)
                .getMarketCollateralAmount(marketId, wrapper.collateralType)
                .mulDecimal(collateralPrice);
        }

        uint initialSkew = totalSynthValue - wrappedMarketCollateral;
        uint initialSkewAdjustment = initialSkew.divDecimal(skewScaleValue);

        uint skewAfterFill = initialSkew;
        // TODO: when the Adjustment after fill is calculated, does it take into account the Adjustments collected for the trade?
        if (isBuyTrade) {
            skewAfterFill += amount;
        } else if (isSellTrade) {
            skewAfterFill -= amount;
        }

        uint skewAfterFillAdjustment = skewAfterFill.divDecimal(skewScaleValue);
        int skewAdjustmentAveragePercentage = (skewAfterFillAdjustment.toInt() +
            initialSkewAdjustment.toInt()) / 2;

        // convert to basis points
        int skewFeeInBips = skewAdjustmentAveragePercentage.mulDecimal(10_000e18);
        skewFee = isSellTrade ? skewFeeInBips * -1 : skewFeeInBips;
    }

    /**
     * @dev Calculates utilization rate fee
     *
     * If no utilizationFeeRate is set, then the fee is 0
     * The utilization rate fee is determined based on the ratio of outstanding synth value to the delegated collateral to the market.
     * Example:
     *  Utilization fee rate set to 100 bips
     *  Total delegated collateral value: $1000
     *  Total outstanding synth value = $1100
     *  User buys $100 worth of synths
     *  Fee calculation = (1100 + 100) / 1000 = 1.2 * 100 = 120 bips
     *
     * TODO: verify this calculation with the team
     */
    function calculateUtilizationRateFee(
        Data storage self,
        uint128 marketId,
        uint amount,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint utilFee) {
        if (self.utilizationFeeRate == 0) {
            return 0;
        }
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );

        uint delegatedCollateral = IMarketManagerModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateral(marketId);

        uint totalBalance = (SynthUtil.getToken(marketId).totalSupply().toInt() +
            asyncOrderConfiguration.asyncUtilizationDelta).toUint();
        uint totalValue = totalBalance.mulDecimal(
            Price.getCurrentPrice(marketId, transactionType)
        ) + amount;

        // utilization is below 100%
        if (delegatedCollateral > totalValue) {
            return 0;
        } else {
            uint utilization = totalValue.divDecimal(delegatedCollateral);

            utilFee = utilization.mulDecimal(self.utilizationFeeRate);
        }
    }

    // TODO: should this live here?  What's a better place? FeeConfigurationModule
    /**
     * @dev Runs the calculated fees through the Fee collector if it exists.
     *
     * The rest of the fees not collected by fee collector is deposited into the market manager
     * If no fee collector is specified, all fees are deposited into the market manager to help staker c-ratios.
     *
     */
    function collectFees(uint128 marketId, uint totalFees) internal returns (uint collectedFees) {
        IFeeCollector feeCollector = load(marketId).feeCollector;
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        if (address(feeCollector) != address(0)) {
            store.usdToken.approve(address(feeCollector), totalFees);

            uint previousUsdBalance = store.usdToken.balanceOf(address(this));
            feeCollector.collectFees(marketId, totalFees);
            uint currentUsdBalance = store.usdToken.balanceOf(address(this));
            collectedFees = currentUsdBalance - previousUsdBalance;

            store.usdToken.approve(address(feeCollector), 0);
        }

        store.depositToMarketManager(marketId, totalFees - collectedFees);
    }

    function _applyFees(
        uint amount,
        int fees // bips 18 decimals
    ) private pure returns (uint amountUsable, int feesCollected) {
        // bips are 18 decimals precision
        feesCollected = fees.mulDecimal(amount.toInt()).divDecimal(10000e18);
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    function _getAtomicFixedFee(Data storage self, address transactor) private view returns (uint) {
        return
            self.atomicFixedFeeOverrides[transactor] > 0
                ? self.atomicFixedFeeOverrides[transactor]
                : self.atomicFixedFee;
    }
}
