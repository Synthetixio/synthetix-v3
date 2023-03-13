//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

import "../interfaces/external/IFeeCollector.sol";
import "./SpotMarketFactory.sol";
import "./AsyncOrder.sol";
import "../utils/SynthUtil.sol";
import "../utils/TransactionUtil.sol";

import "hardhat/console.sol";

/**
 * @title Fee storage that tracks all fees for a given market Id.
 */
library FeeConfiguration {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using DecimalMath for int256;

    struct Data {
        /**
         * @dev The atomic fixed fee rate for a specific transactor.  Useful for direct integrations to set custom fees for specific addresses.
         */
        mapping(address => uint) atomicFixedFeeOverrides;
        /**
         * @dev atomic buy/sell fixed fee that's applied on all trades. Percentage, 18 decimals
         */
        uint atomicFixedFee;
        /**
         * @dev buy/sell fixed fee that's applied on all async trades. Percentage, 18 decimals
         */
        uint asyncFixedFee;
        /**
         * @dev utilization fee rate (in percentage) is the rate of fees applied based on the ratio of delegated collateral to total outstanding synth exposure. 18 decimals
         * applied on buy trades only.
         */
        uint utilizationFeeRate;
        /**
         * @dev wrapping fee rate represented as a percent, 18 decimals
         */
        int wrapFixedFee;
        /**
         * @dev unwrapping fee rate represented as a percent, 18 decimals
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
        /**
         * @dev Percentage share for each referrer address
         */
        mapping(address => uint) referrerShare;
    }

    function load(uint128 marketId) internal pure returns (Data storage feeConfiguration) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            feeConfiguration.slot := s
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
     * @dev Calculates fees for a given transaction type.
     */
    function calculateFees(
        Data storage feeConfiguration,
        uint128 marketId,
        address transactor,
        uint256 amount,
        uint256 synthPrice,
        Transaction.Type transactionType
    )
        internal
        view
        returns (uint256 amountAfterFees, int256 feesCollected, uint referrerShareableFees)
    {
        if (Transaction.isBuy(transactionType)) {
            (amountAfterFees, feesCollected, referrerShareableFees) = calculateBuyFees(
                feeConfiguration,
                transactor,
                marketId,
                amount,
                synthPrice,
                transactionType
            );
        } else if (Transaction.isSell(transactionType)) {
            (amountAfterFees, feesCollected, referrerShareableFees) = calculateSellFees(
                feeConfiguration,
                transactor,
                marketId,
                amount,
                transactionType
            );
        } else if (transactionType == Transaction.Type.WRAP) {
            (amountAfterFees, feesCollected) = calculateWrapFees(feeConfiguration, amount);
        } else if (transactionType == Transaction.Type.UNWRAP) {
            (amountAfterFees, feesCollected) = calculateUnwrapFees(feeConfiguration, amount);
        } else {
            amountAfterFees = amount;
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
        uint256 synthPrice,
        Transaction.Type transactionType
    ) internal view returns (uint amountUsable, int calculatedFees, uint fixedFee) {
        uint utilizationFee = calculateUtilizationRateFee(
            feeConfiguration,
            marketId,
            amount,
            synthPrice
        );

        fixedFee = _getFixedFee(feeConfiguration, transactor, Transaction.isAsync(transactionType));

        int skewFee;
        if (transactionType == Transaction.Type.BUY_EXACT_IN) {
            skewFee = calculateSkewFeeByUsd(
                feeConfiguration,
                marketId,
                amount,
                synthPrice,
                transactionType
            );
        } else if (transactionType == Transaction.Type.BUY_EXACT_OUT) {
            skewFee = calculateSkewFeeBySynthAmount(
                feeConfiguration,
                marketId,
                amount,
                transactionType
            );

            amount = amount.mulDecimal(synthPrice);
            feesCollected = fees.mulDecimal(amount.toInt());
        }

        int totalFees = utilizationFee.toInt() + skewFee + fixedFee.toInt();

        (amountUsable, calculatedFees) = _applyFees(amount, totalFees);
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
        uint256 synthAmount,
        uint synthPrice,
        Transaction.Type transactionType
    ) internal view returns (uint amountUsable, int feesCollected, uint fixedFee) {
        int skewFee = calculateSkewFeeExact(
            feeConfiguration,
            marketId,
            synthAmount,
            transactionType
        );

        fixedFee = _getFixedFee(feeConfiguration, transactor, Transaction.isAsync(transactionType));

        int totalFees = skewFee + fixedFee.toInt();

        (amountUsable, feesCollected) = _applyFees(synthAmount, totalFees);
    }

    function calculateSkewFeeExact(
        Data storage self,
        uint128 marketId,
        uint amount,
        uint synthPrice,
        Transaction.Type transactionType
    ) internal view returns (int skewFee) {
        if (self.skewScale == 0) {
            return 0;
        }

        int amountInt = amount.toInt();

        bool isBuyTrade = Transaction.isBuy(transactionType);
        bool isSellTrade = Transaction.isSell(transactionType);

        if (!isBuyTrade && !isSellTrade) {
            return 0;
        }

        uint wrappedCollateralAmount = SpotMarketFactory
            .load()
            .synthetix
            .getMarketCollateralAmount(marketId, Wrapper.load(marketId).wrapCollateralType)
            .mulDecimal(synthPrice);

        int initialSkew = SynthUtil
            .getToken(marketId)
            .totalSupply()
            .mulDecimal(synthPrice)
            .toInt() - wrappedCollateralAmount.toInt();

        int skew = Transaction.isBuy(transactionType)
            ? initialSkew + amountInt
            : initialSkew - amountInt;

        int avgSkew = (skew + initialSkew) / 2;
        skewFee = avgSkew.divDecimal(self.skewScale.toInt());
        if (Transaction.isSell(transactionType)) {
            skewFee = skewFee * -1;
        }
    }

    function calculateSkewFeeByUsd(
        Data storage feeConfiguration,
        uint128 marketId,
        uint amount,
        uint synthPrice,
        Transaction.Type transactionType
    ) internal view returns (int skewFee) {
        if (feeConfiguration.skewScale == 0) {
            return 0;
        }

        bool isBuyTrade = Transaction.isBuy(transactionType);
        bool isSellTrade = Transaction.isSell(transactionType);

        if (!isBuyTrade && !isSellTrade) {
            return 0;
        }

        uint wrappedCollateralAmount = SpotMarketFactory.load().synthetix.getMarketCollateralAmount(
            marketId,
            Wrapper.load(marketId).wrapCollateralType
        );

        int initialSkew = SynthUtil.getToken(marketId).totalSupply().toInt() -
            wrappedCollateralAmount.toInt();

        int amountOut = _calculateSkewAmountOut(feeConfiguration, amount, synthPrice, initialSkew);
        int amountOutWithoutSkew = (amount.divDecimal(synthPrice)).toInt();

        return (amountOutWithoutSkew - amountOut).divDecimal(amountOutWithoutSkew);
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
     *  Utilization Rate Delta = 120 - 110 = 10% / 2 (average) = 5%
     *  Fee charged = 5 * 0.001 (0.1%)  = 0.5%
     *
     */
    function calculateUtilizationRateFee(
        FeeConfiguration.Data storage feeConfiguration,
        uint128 marketId,
        uint amount,
        uint256 synthPrice
    ) internal view returns (uint utilFee) {
        if (feeConfiguration.utilizationFeeRate == 0) {
            return 0;
        }

        uint delegatedCollateral = SpotMarketFactory.load().synthetix.getMarketCollateral(marketId);

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply();

        // Note: take into account the async order commitment amount in escrow
        uint totalValueBeforeFill = totalBalance.mulDecimal(synthPrice);
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
        Data storage self,
        uint128 marketId,
        int totalFees,
        address transactor,
        SpotMarketFactory.Data storage factory,
        Transaction.Type transactionType
    ) internal returns (uint feeCollectorQuote) {
        if (totalFees <= 0 || address(self.feeCollector) == address(0)) {
            return 0;
        }

        uint totalFeesUint = totalFees.toUint();

        feeCollectorQuote = self.feeCollector.quoteFees(
            marketId,
            totalFeesUint,
            transactor,
            uint8(transactionType)
        );

        if (Transaction.isSell(transactionType)) {
            factory.synthetix.withdrawMarketUsd(marketId, address(this), feeCollectorQuote);
        }

        self.feeCollector.collectFees(marketId, totalFeesUint, transactor, uint8(transactionType));
    }

    function quoteFees(
        uint128 marketId,
        int totalFees,
        address transactor,
        Transaction.Type transactionType
    ) internal returns (uint collectedFees) {
        if (totalFees <= 0) {
            return 0;
        }

        uint totalFeesUint = totalFees.toUint();

        IFeeCollector feeCollector = FeeConfiguration.load(marketId).feeCollector;

        if (address(feeCollector) != address(0)) {
            collectedFees = feeCollector.quoteFees(
                marketId,
                totalFeesUint,
                transactor,
                // solhint-disable-next-line numcast/safe-cast
                uint8(transactionType)
            );
        }
    }

    function _applyFees(
        uint amount,
        int fees // 18 decimals
    ) private pure returns (uint amountUsable, int feesCollected) {
        feesCollected = fees.mulDecimal(amount.toInt());
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    /*
     * @dev if special fee is set for a given transactor that takes precedence over the global fixed fees
     * otherwise, if async order, use async fixed fee, otherwise use atomic fixed fee
     */
    function _getFixedFee(
        FeeConfiguration.Data storage feeConfiguration,
        address transactor,
        bool async
    ) private view returns (uint fixedFee) {
        if (feeConfiguration.atomicFixedFeeOverrides[transactor] > 0) {
            fixedFee = feeConfiguration.atomicFixedFeeOverrides[transactor];
        } else {
            fixedFee = async ? feeConfiguration.asyncFixedFee : feeConfiguration.atomicFixedFee;
        }
    }

    function _calculateSkewAmountOut(
        Data storage self,
        uint amount,
        uint price,
        int initialSkew
    ) private view returns (int amountOut) {
        uint skewPriceRatio = self.skewScale.divDecimal(2 * price);
        uint costPriceSkewRatio = (8 * amount.mulDecimal(price)).divDecimal(self.skewScale);
        int initialSkewPriceRatio = (2 * initialSkew.mulDecimal(price.toInt())).divDecimal(
            self.skewScale.toInt()
        );

        int ratioSquared = _pow(initialSkewPriceRatio + 2 * price.toInt(), 2);
        int sqrt = _sqrt(costPriceSkewRatio.toInt() + ratioSquared);

        return skewPriceRatio.toInt().mulDecimal(sqrt) - self.skewScale.toInt() - initialSkew;
    }

    function _sqrt(int x) internal pure returns (int y) {
        int z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x.divDecimal(z) + z) / 2;
        }
    }

    function _pow(int x, uint n) internal pure returns (int r) {
        r = 1e18;
        while (n > 0) {
            if (n % 2 == 1) {
                r = r.mulDecimal(x);
                n -= 1;
            } else {
                x = x.mulDecimal(x);
                n /= 2;
            }
        }
    }
}
