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
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using Price for Price.Data;

    enum TradeType {
        BUY,
        SELL,
        WRAP,
        UNWRAP
    }

    struct Data {
        uint interestRate;
        uint fixedFee;
        uint skewScale;
        uint skewFeePercentage; // in bips
        uint[] utilizationThresholds;
        uint utilizationFeeRate; // in bips
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Fee", marketId));
        assembly {
            store.slot := s
        }
    }

    function calculateFees(
        uint128 marketId,
        address transactor,
        int256 amount,
        TradeType tradeType
    ) internal returns (int amountUsable, uint feesCollected) {
        Data storage self = load(marketId);

        // TODO: only buy trades have fees currently; how to handle for other trade types?
        if (tradeType == TradeType.BUY) {
            (amountUsable, feesCollected) = calculateBuyFees(self, marketId, amount);
        } else {
            amountUsable = amount;
            feesCollected = 0;
        }
    }

    function calculateBuyFees(
        Data storage self,
        uint128 marketId,
        int256 amount
    ) internal returns (int amountUsable, uint feesCollected) {
        // generally, only one of these will be non-zero
        uint skewFee = calculateSkewFee(self, marketId);
        uint utilizationFee = calculateUtilizationRateFee(self, marketId, TradeType.BUY);

        // TODO: fixed fee?

        uint totalFees = skewFee + utilizationFee;

        feesCollected = totalFees.mulDecimal(amount.toUint()).divDecimal(10000);
        amountUsable = amount - feesCollected.toInt();
    }

    function calculateSkewFee(Data storage self, uint128 marketId) internal returns (uint skewFee) {
        if (self.skewScale == 0 || self.skewFeePercentage == 0) {
            return 0;
        }

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply();
        uint wrappedMarketCollateral = 0;

        Wrapper.Data storage wrapper = Wrapper.load(marketId);
        if (wrapper.wrappingEnabled) {
            wrappedMarketCollateral = IMarketCollateralModule(SpotMarketFactory.load().synthetix)
                .getMarketCollateralAmount(marketId, wrapper.collateralType);
        }

        uint skew = totalBalance - wrappedMarketCollateral;
        uint skewThreshold = skew.divDecimal(self.skewScale);
        skewFee = skewThreshold.mulDecimal(self.skewFeePercentage);
    }

    function calculateUtilizationRateFee(
        Data storage self,
        uint128 marketId,
        TradeType tradeType
    ) internal view returns (uint utilFee) {
        if (self.utilizationThresholds.length == 0 || self.utilizationFeeRate == 0) {
            return 0;
        }

        uint delegatedCollateral = IMarketManagerModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateral(marketId);

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply();
        uint totalValue = totalBalance.mulDecimal(
            Price.load(marketId).getCurrentPrice(tradeType).toUint()
        );

        // utilization is below 100%
        if (delegatedCollateral > totalValue) {
            return 0;
        } else {
            // TODO: do we need thresholds for utilization rate? can just use average rate
            uint utilization = delegatedCollateral.divDecimal(totalValue);

            utilFee = utilization.mulDecimal(self.utilizationFeeRate);
        }
    }
}
