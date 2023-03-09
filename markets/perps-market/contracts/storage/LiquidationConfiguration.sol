//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "../utils/MathUtil.sol";

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

    function liquidationMargin(
        LiquidationConfiguration.Data storage config,
        int positionSize,
        uint price
    ) internal view returns (uint) {
        uint liquidationBuffer = MathUtil.abs(positionSize).mulDecimal(price).mulDecimal(
            config.liquidationBufferRatio
        );
        return
            liquidationBuffer +
            MathUtil.max(
                MathUtil.min(liquidationBuffer, config.maxLiquidationRewardUsd),
                config.minLiquidationRewardUsd
            ) +
            config.desiredLiquidationRewardPercentage;
    }

    // function liquidationFee(
    //     LiquidationConfiguration.Data storage config,
    //     int positionSize,
    //     uint price
    // ) internal view returns (uint lFee) {
    //     // size * price * fee-ratio
    //     uint proportionalFee = MathUtil.abs(positionSize).mulDecimal(price).mulDecimal(
    //         config.liquidationBufferRatio
    //     );
    //     uint maxFee = config.maxLiquidationRewardUsd;
    //     uint cappedProportionalFee = proportionalFee > maxFee ? maxFee : proportionalFee;
    //     uint minFee = config.minLiquidationRewardUsd;

    //     // max(proportionalFee, minFee) - to prevent not incentivising liquidations enough
    //     return cappedProportionalFee > minFee ? cappedProportionalFee : minFee; // not using _max() helper because it's for signed ints
    // }
}
