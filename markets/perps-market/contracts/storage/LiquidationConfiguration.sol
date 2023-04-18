//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library LiquidationConfiguration {
    using DecimalMath for int256;
    using DecimalMath for uint256;

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
        uint liquidationBufferRatio;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.LiquidationConfiguration", marketId)
        );
        assembly {
            store.slot := s
        }
    }

    // TODO: double check this eq and fix it
    function liquidationMargin(
        Data storage config,
        uint notionalValue
    ) internal view returns (uint) {
        uint liquidationBufferMargin = notionalValue.mulDecimal(config.liquidationBufferRatio);
        uint rewardMargin = notionalValue.mulDecimal(config.desiredLiquidationRewardPercentage);

        return
            liquidationBufferMargin +
            MathUtil.max(
                MathUtil.min(liquidationBufferMargin, config.maxLiquidationRewardUsd),
                config.minLiquidationRewardUsd
            ) +
            rewardMargin;
    }
}
