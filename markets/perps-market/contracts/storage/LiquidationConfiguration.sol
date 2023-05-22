//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library LiquidationConfiguration {
    using DecimalMath for int256;
    using DecimalMath for uint256;

    struct Data {
        /**
         * @dev % of the notional value that is required in margin when initially opening position
         */
        uint initialMarginPercentage;
        /**
         * @dev % of the notional value that is required in margin during maintenance and checking for liquidation eligibility
         */
        uint marginMaintenancePercentage;
        /**
         * @dev minimum configured liquidation reward for the sender who liquidates the account
         */
        uint minLiquidationRewardUsd;
        /**
         * @dev maximum configured liquidation reward for the sender who liquidates the account
         */
        uint maxLiquidationRewardUsd;
        /**
         * @dev This multiplier is applied to the max liquidation value when calculating max liquidation for a given market
         */
        uint256 maxLiquidationLimitAccumulationMultiplier;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.LiquidationConfiguration", marketId)
        );
        assembly {
            store.slot := s
        }
    }

    function liquidationMargin(
        Data storage config,
        uint256 notionalValueOfPosition
    ) internal view returns (uint256 initialMargin, uint256 maintenanceMargin) {
        initialMargin = notionalValueOfPosition.mulDecimal(config.initialMarginPercentage);
        maintenanceMargin = notionalValueOfPosition.mulDecimal(config.marginMaintenancePercentage);
    }
}
