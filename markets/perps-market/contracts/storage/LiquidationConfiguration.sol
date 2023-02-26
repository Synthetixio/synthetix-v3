//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library LiquidationConfiguration {
    struct Data {
        uint liquidationPremiumMultiplier;
        uint maxLiquidationDelta;
        uint maxPremiumDiscount;
        // usd denominated
        uint minLiquidationRewardUsd;
        // usd denominated
        uint maxLiquidationRewardUsd;
        // % of liquidated position
        uint desiredLiquidationRewardPercentage;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.LiquidationConfiguration", marketId)
        );
        assembly {
            store.slot := s
        }
    }
}
