//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {MathUtil} from "../utils/MathUtil.sol";

/*
    Note: This library contains all global perps market configuration data
*/
library GlobalPerpsMarketConfiguration {
    bytes32 private constant _SLOT_GLOBAL_PERPS_MARKET_CONFIGURATION =
        keccak256(abi.encode("io.synthetix.perps-market.GlobalPerpsMarketConfiguration"));

    struct Data {
        /**
         * @dev mapping of configured synthMarketId to max collateral amount.
         * @dev USD token synth market id = 0
         */
        mapping(uint128 => uint) maxCollateralAmounts;
        /**
         * @dev when deducting from user's margin which is made up of many synths, this priority governs which synth to sell for deduction
         */
        uint128[] synthDeductionPriority;
        /**
         * @dev minimum configured liquidation reward for the sender who liquidates the account
         */
        uint minLiquidationRewardUsd;
        /**
         * @dev maximum configured liquidation reward for the sender who liquidates the account
         */
        uint maxLiquidationRewardUsd;
    }

    function load() internal pure returns (Data storage globalMarketConfig) {
        bytes32 s = _SLOT_GLOBAL_PERPS_MARKET_CONFIGURATION;
        assembly {
            globalMarketConfig.slot := s
        }
    }

    /**
     * @dev returns the liquidation reward based on total liquidation rewards from all markets compared against min/max
     */
    function liquidationReward(
        Data storage self,
        uint256 totalLiquidationRewards
    ) internal view returns (uint256) {
        return
            MathUtil.min(
                MathUtil.max(totalLiquidationRewards, self.minLiquidationRewardUsd),
                self.maxLiquidationRewardUsd
            );
    }
}
