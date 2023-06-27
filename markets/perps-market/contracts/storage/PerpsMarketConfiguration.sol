//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {OrderFee} from "./OrderFee.sol";
import {SettlementStrategy} from "./SettlementStrategy.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library PerpsMarketConfiguration {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI128 for int128;

    error InvalidSettlementStrategy(uint128 settlementStrategyId);

    struct Data {
        OrderFee.Data orderFees;
        SettlementStrategy.Data[] settlementStrategies;
        uint256 maxMarketValue; // oi cap
        uint256 maxFundingVelocity;
        uint256 skewScale;
        /**
         * @dev the initial margin requirements for this market when opening a position
         * @dev this fraction is multiplied by the impact of the position on the skew (open position size / skewScale)
         */
        uint256 initialMarginRatioD18;
        /**
         * @dev the maintenance margin requirements for this market when opening a position
         * @dev this generally will be lower than initial margin but is used to determine when to liquidate a position
         * @dev this fraction is multiplied by the impact of the position on the skew (position size / skewScale)
         */
        uint256 maintenanceMarginRatioD18;
        uint256 lockedOiRatioD18;
        /**
         * @dev This multiplier is applied to the max liquidation value when calculating max liquidation for a given market
         */
        uint256 maxLiquidationLimitAccumulationMultiplier;
        /**
         * @dev This configured window is the max liquidation amount that can be accumulated.
         * @dev If you multiply maxLiquidationPerSecond * this window in seconds, you get the max liquidation amount that can be accumulated within this window
         */
        uint256 maxSecondsInLiquidationWindow;
        /**
         * @dev This value is multiplied by the notional value of a position to determine liquidation reward
         */
        uint256 liquidationRewardRatioD18;
        /**
         * @dev minimum position value in USD, this is used when we calculate maintenance margin
         */
        uint256 minimumPositionMargin;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.PerpsMarketConfiguration", marketId)
        );
        assembly {
            store.slot := s
        }
    }

    function maxLiquidationAmountPerSecond(Data storage self) internal view returns (uint256) {
        OrderFee.Data storage orderFeeData = self.orderFees;
        return
            (orderFeeData.makerFee + orderFeeData.takerFee).mulDecimal(self.skewScale).mulDecimal(
                self.maxLiquidationLimitAccumulationMultiplier
            );
    }

    function calculateLiquidationReward(
        Data storage self,
        uint256 notionalValue
    ) internal view returns (uint256) {
        return notionalValue.mulDecimal(self.liquidationRewardRatioD18);
    }

    function calculateRequiredMargins(
        Data storage self,
        int128 size,
        uint256 price
    )
        internal
        view
        returns (
            uint256 initialMarginRatio,
            uint256 maintenanceMarginRatio,
            uint256 initialMargin,
            uint256 maintenanceMargin,
            uint256 liquidationMargin
        )
    {
        uint256 sizeAbs = MathUtil.abs(size.to256());
        uint256 impactOnSkew = self.skewScale == 0 ? 0 : sizeAbs.divDecimal(self.skewScale);

        initialMarginRatio = impactOnSkew.mulDecimal(self.initialMarginRatioD18);
        maintenanceMarginRatio = impactOnSkew.mulDecimal(self.maintenanceMarginRatioD18);

        uint256 notional = sizeAbs.mulDecimal(price);
        initialMargin = notional.mulDecimal(initialMarginRatio);
        maintenanceMargin = notional.mulDecimal(maintenanceMarginRatio);

        liquidationMargin = calculateLiquidationReward(self, notional);
    }

    /**
     * @notice given a strategy id, returns the entire settlement strategy struct
     */
    function loadValidSettlementStrategy(
        Data storage self,
        uint128 settlementStrategyId
    ) internal view returns (SettlementStrategy.Data storage strategy) {
        if (settlementStrategyId >= self.settlementStrategies.length) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }

        strategy = self.settlementStrategies[settlementStrategyId];
        if (strategy.disabled) {
            revert InvalidSettlementStrategy(settlementStrategyId);
        }
    }
}
