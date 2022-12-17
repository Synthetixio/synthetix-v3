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

    enum TradeType {
        BUY,
        SELL,
        WRAP,
        UNWRAP,
        ASYNC_BUY,
        ASYNC_SELL
    }

    struct Data {
        uint fixedFee;
        uint skewScale;
        uint utilizationFeeRate; // in bips
        uint wrapFee;
        uint unwrapFee;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            store.slot := s
        }
    }

    function calculateFees(
        uint128 marketId,
        address transactor,
        uint256 usdAmount,
        TradeType tradeType
    ) internal returns (uint amountUsable, int feesCollected) {
        Data storage self = load(marketId);

        // getCustomTransactorFees(marketId, transactor, tradeType);
        // pass normal fee data if no custom exists in below functions

        // TODO: only buy trades have fees currently; how to handle for other trade types?
        if (tradeType == TradeType.BUY) {
            (amountUsable, feesCollected) = calculateAtomicBuyFees(self, marketId, usdAmount);
        } else if (tradeType == TradeType.SELL) {
            (amountUsable, feesCollected) = calculateAtomicSellFees(self, marketId, usdAmount);
        } else if (tradeType == TradeType.WRAP) {
            (amountUsable, feesCollected) = calculateWrapFees(self, usdAmount);
        } else if (tradeType == TradeType.UNWRAP) {
            (amountUsable, feesCollected) = calculateUnwrapFees(self, usdAmount);
            // Add for ASYNC orders as well
        } else {
            amountUsable = usdAmount;
            feesCollected = 0;
        }

        // sanity check? revert unless usdAmount =  amountUsable + feesCollected
    }

    function calculateWrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        feesCollected = self.wrapFee.mulDecimal(amount).divDecimal(10000).toInt();
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    function calculateUnwrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        feesCollected = self.unwrapFee.mulDecimal(amount).divDecimal(10000).toInt();
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    function calculateAtomicBuyFees(
        Data storage self,
        uint128 marketId,
        uint256 amount
    ) internal returns (uint amountUsable, int feesCollected) {
        int skewFee = calculateSkewFee(self, marketId, amount, TradeType.BUY);
        uint utilizationFee = calculateUtilizationRateFee(self, marketId, TradeType.BUY);

        int totalFees = skewFee + utilizationFee.toInt() + self.fixedFee.toInt();

        feesCollected = totalFees.mulDecimal(amount.toInt()).divDecimal(10000);
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    function calculateAtomicSellFees(
        Data storage self,
        uint128 marketId,
        uint256 amount
    ) internal returns (uint amountUsable, int feesCollected) {
        int skewFee = calculateSkewFee(self, marketId, amount, TradeType.SELL);

        int totalFees = self.fixedFee.toInt() + skewFee;

        feesCollected = totalFees.mulDecimal(amount.toInt()).divDecimal(10000);
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    function calculateSkewFee(
        Data storage self,
        uint128 marketId,
        uint amount,
        TradeType tradeType
    ) internal returns (int skewFee) {
        if (self.skewScale == 0) {
            return 0;
        }

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply().mulDecimal(
            Price.load(marketId).getCurrentPrice(tradeType)
        );
        uint wrappedMarketCollateral = 0;

        Wrapper.Data storage wrapper = Wrapper.load(marketId);
        wrappedMarketCollateral = IMarketCollateralModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateralAmount(marketId, wrapper.collateralType);

        uint initialSkew = totalBalance - wrappedMarketCollateral;
        uint initialSkewFee = initialSkew.divDecimal(self.skewScale);

        uint skewAfterFill = initialSkew;
        // TODO: when the fee after fill is calculated, does it take into account the fees collected for the trade?
        if (tradeType == TradeType.BUY) {
            skewAfterFill += amount;
        } else if (tradeType == TradeType.SELL) {
            skewAfterFill -= amount;
        }
        uint skewAfterFillFee = skewAfterFill.divDecimal(self.skewScale);

        skewFee = (skewAfterFillFee.toInt() + initialSkewFee.toInt()).divDecimal(2);
        if (tradeType == TradeType.SELL) {
            skewFee = skewFee * -1;
        }
    }

    function calculateUtilizationRateFee(
        Data storage self,
        uint128 marketId,
        TradeType tradeType
    ) internal view returns (uint utilFee) {
        if (self.utilizationFeeRate == 0) {
            return 0;
        }

        uint delegatedCollateral = IMarketManagerModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateral(marketId);

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply();
        uint totalValue = totalBalance.mulDecimal(Price.load(marketId).getCurrentPrice(tradeType));

        // utilization is below 100%
        if (delegatedCollateral > totalValue) {
            return 0;
        } else {
            uint utilization = delegatedCollateral.divDecimal(totalValue);

            utilFee = utilization.mulDecimal(self.utilizationFeeRate);
        }
    }
}
