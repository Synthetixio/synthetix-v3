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
        // used for direct integrations
        mapping(address => uint) atomicFixedFeeOverrides;
        // defaults
        uint atomicFixedFee;
        uint asyncFixedFee;
        uint utilizationFeeRate; // in bips, applied on buy and async buy
        uint wrapFixedFee;
        uint unwrapFixedFee;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            store.slot := s
        }
    }

    function setFeeForTransactor(uint128 marketId, address transactor, uint fixedFee) internal {
        load(marketId).atomicFixedFeeOverrides[transactor] = fixedFee;
    }

    function calculateFees(
        uint128 marketId,
        address transactor,
        uint256 usdAmount,
        TradeType tradeType
    ) internal returns (uint256 amountUsable, uint256 feesCollected) {
        Data storage self = load(marketId);

        // TODO: only buy trades have fees currently; how to handle for other trade types?
        if (tradeType == TradeType.BUY) {
            (amountUsable, feesCollected) = calculateAtomicBuyFees(
                self,
                transactor,
                marketId,
                usdAmount
            );
        } else if (tradeType == TradeType.SELL) {
            (amountUsable, feesCollected) = calculateAtomicSellFees(self, transactor, usdAmount);
        } else if (tradeType == TradeType.WRAP) {
            (amountUsable, feesCollected) = calculateWrapFees(self, usdAmount);
        } else if (tradeType == TradeType.UNWRAP) {
            (amountUsable, feesCollected) = calculateUnwrapFees(self, usdAmount);
        } else if (tradeType == TradeType.ASYNC_BUY) {
            (amountUsable, feesCollected) = calculateAsyncBuyFees(self, marketId, usdAmount);
        } else if (tradeType == TradeType.ASYNC_SELL) {
            (amountUsable, feesCollected) = calculateAsyncSellFees(self, usdAmount);
        } else {
            amountUsable = usdAmount;
            feesCollected = 0;
        }

        // sanity check? revert unless usdAmount =  amountUsable + feesCollected
    }

    function calculateWrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, uint feesCollected) {
        feesCollected = self.wrapFixedFee.mulDecimal(amount).divDecimal(10000);
        amountUsable = amount - feesCollected;
    }

    function calculateUnwrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, uint feesCollected) {
        feesCollected = self.unwrapFixedFee.mulDecimal(amount).divDecimal(10000);
        amountUsable = amount - feesCollected;
    }

    function calculateAtomicBuyFees(
        Data storage self,
        address transactor,
        uint128 marketId,
        uint256 amount
    ) internal view returns (uint amountUsable, uint feesCollected) {
        uint utilizationFee = calculateUtilizationRateFee(self, marketId, TradeType.BUY);

        uint totalFees = utilizationFee + _getAtomicFixedFee(self, transactor);

        feesCollected = totalFees.mulDecimal(amount).divDecimal(10000);
        amountUsable = amount - feesCollected;
    }

    function calculateAtomicSellFees(
        Data storage self,
        address transactor,
        uint256 amount
    ) internal view returns (uint amountUsable, uint feesCollected) {
        feesCollected = _getAtomicFixedFee(self, transactor).mulDecimal(amount).divDecimal(10000);
        amountUsable = amount - feesCollected;
    }

    function calculateAsyncBuyFees(
        Data storage self,
        uint128 marketId,
        uint256 amount
    ) internal view returns (uint amountUsable, uint feesCollected) {
        uint utilizationFee = calculateUtilizationRateFee(self, marketId, TradeType.BUY);

        uint totalFees = utilizationFee + self.asyncFixedFee;

        feesCollected = totalFees.mulDecimal(amount).divDecimal(10000);
        amountUsable = amount - feesCollected;
    }

    function calculateAsyncSellFees(
        Data storage self,
        uint256 amount
    ) internal returns (uint amountUsable, uint feesCollected) {
        feesCollected = self.asyncFixedFee.mulDecimal(amount).divDecimal(10000);
        amountUsable = amount - feesCollected;
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

    function _getAtomicFixedFee(Data storage self, address transactor) private view returns (uint) {
        return
            self.atomicFixedFeeOverrides[transactor] > 0
                ? self.atomicFixedFeeOverrides[transactor]
                : self.atomicFixedFee;
    }
}
