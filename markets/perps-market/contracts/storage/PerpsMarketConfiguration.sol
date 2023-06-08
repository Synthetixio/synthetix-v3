//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {OrderFee} from "./OrderFee.sol";
import {SettlementStrategy} from "./SettlementStrategy.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library PerpsMarketConfiguration {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;

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
        uint256 initialMarginFraction;
        /**
         * @dev the maintenance margin requirements for this market when opening a position
         * @dev this generally will be lower than initial margin but is used to determine when to liquidate a position
         * @dev this fraction is multiplied by the impact of the position on the skew (position size / skewScale)
         */
        uint256 maintenanceMarginFraction;
        uint256 lockedOiPercent;
        /**
         * @dev This multiplier is applied to the max liquidation value when calculating max liquidation for a given market
         */
        uint256 maxLiquidationLimitAccumulationMultiplier;
        /**
         * @dev This value is multiplied by the notional value of a position to determine liquidation reward
         */
        uint256 liquidationRewardRatioD18;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.PerpsMarketConfiguration", marketId)
        );
        assembly {
            store.slot := s
        }
    }

    function calculateLiquidationMargin(
        Data storage self,
        uint256 notionalValue
    ) internal view returns (uint256) {
        return notionalValue.mulDecimal(self.liquidationRewardRatioD18);
    }

    function calculateRequiredMargins(
        Data storage self,
        uint256 notionalValue
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
        uint256 impactOnSkew = notionalValue.divDecimal(self.skewScale);

        initialMarginRatio = impactOnSkew.mulDecimal(self.initialMarginFraction);
        maintenanceMarginRatio = impactOnSkew.mulDecimal(self.maintenanceMarginFraction);
        initialMargin = notionalValue.mulDecimal(initialMarginRatio);
        maintenanceMargin = notionalValue.mulDecimal(maintenanceMarginRatio);

        liquidationMargin = calculateLiquidationMargin(self, notionalValue);
    }
}
