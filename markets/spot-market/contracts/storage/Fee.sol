//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../utils/SynthUtil.sol";
import "../storage/SpotMarketFactory.sol";
import "./Price.sol";
import "./Wrapper.sol";

library Fee {
    using DecimalMath for uint256;
    using DecimalMath for int256;
    using Price for Price.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    struct Data {
        // used for direct integrations
        mapping(address => uint) atomicFixedFeeOverrides;
        // defaults
        uint atomicFixedFee;
        uint asyncFixedFee;
        uint utilizationFeeRate; // in bips, applied on buy and async buy
        int wrapFixedFee;
        int unwrapFixedFee;
        uint skewScale;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            store.slot := s
        }
    }

    function setAtomicFixedFeeOverride(
        uint128 marketId,
        address transactor,
        uint fixedFee
    ) internal {
        load(marketId).atomicFixedFeeOverrides[transactor] = fixedFee;
    }

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

    function calculateWrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        (amountUsable, feesCollected) = _applyFees(amount, self.wrapFixedFee);
    }

    function calculateUnwrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        (amountUsable, feesCollected) = _applyFees(amount, self.unwrapFixedFee);
    }

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

    function calculateSellFees(
        Data storage self,
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

        uint fixedFee = async ? self.asyncFixedFee : self.atomicFixedFee;
        int totalFees = skewFee + fixedFee.toInt();

        (amountUsable, feesCollected) = _applyFees(amount, totalFees);
    }

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

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply().mulDecimal(
            Price.getCurrentPrice(marketId, transactionType)
        );

        Wrapper.Data storage wrapper = Wrapper.load(marketId);
        uint wrappedMarketCollateral = IMarketCollateralModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateralAmount(marketId, wrapper.collateralType);

        uint initialSkew = totalBalance - wrappedMarketCollateral;
        uint initialSkewAdjustment = initialSkew.divDecimal(self.skewScale);

        uint skewAfterFill = initialSkew;
        // TODO: when the Adjustment after fill is calculated, does it take into account the Adjustments collected for the trade?
        if (isBuyTrade) {
            skewAfterFill += amount;
        } else if (isSellTrade) {
            skewAfterFill -= amount;
        }
        uint skewAfterFillAdjustment = skewAfterFill.divDecimal(self.skewScale);

        int skewAdjustmentAverage = (skewAfterFillAdjustment.toInt() +
            initialSkewAdjustment.toInt()).divDecimal(2);

        skewFee = isSellTrade ? skewAdjustmentAverage * -1 : skewAdjustmentAverage;
    }

    function calculateUtilizationRateFee(
        Data storage self,
        uint128 marketId,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint utilFee) {
        if (self.utilizationFeeRate == 0) {
            return 0;
        }

        uint delegatedCollateral = IMarketManagerModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateral(marketId);

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply();
        uint totalValue = totalBalance.mulDecimal(Price.getCurrentPrice(marketId, transactionType));

        // utilization is below 100%
        if (delegatedCollateral > totalValue) {
            return 0;
        } else {
            uint utilization = delegatedCollateral.divDecimal(totalValue);

            utilFee = utilization.mulDecimal(self.utilizationFeeRate);
        }
    }

    function _applyFees(
        uint amount,
        int fees // bips
    ) private view returns (uint amountUsable, int feesCollected) {
        feesCollected = fees.mulDecimal(amount.toInt()).divDecimal(10000);
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    function _getAtomicFixedFee(Data storage self, address transactor) private view returns (uint) {
        return
            self.atomicFixedFeeOverrides[transactor] > 0
                ? self.atomicFixedFeeOverrides[transactor]
                : self.atomicFixedFee;
    }
}
