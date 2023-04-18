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

    enum OrderType {
        ASYNC_ONCHAIN,
        ASYNC_OFFCHAIN,
        ATOMIC
    }

    struct Data {
        mapping(OrderType => OrderFee.Data) orderFees;
        SettlementStrategy.Data[] settlementStrategies;
        uint256 maxMarketValue; // oi cap
        uint256 maxFundingVelocity;
        uint256 skewScale;
        uint256 minInitialMargin;
        uint256 liquidationPremiumMultiplier;
        uint256 lockedOiPercent;
        // liquidation params
        uint256 maxLiquidationLimitAccumulationMultiplier;
        // liquidation rewards
        uint liquidationRewardPercentage;
        uint maxLiquidationReward;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.PerpsMarketConfiguration", marketId)
        );
        assembly {
            store.slot := s
        }
    }

    function calculateSettlementReward(
        Data storage self,
        uint liquidatedUsd
    ) internal view returns (uint) {
        uint amountBasedOnLiquidatedAmount = liquidatedUsd.mulDecimal(
            self.liquidationRewardPercentage
        );

        return MathUtil.min(amountBasedOnLiquidatedAmount, self.maxLiquidationReward);
    }

    function liquidationPremium(
        PerpsMarketConfiguration.Data storage marketConfig,
        int positionSize,
        uint currentPrice
    ) internal view returns (uint) {
        if (positionSize == 0) {
            return 0;
        }

        // note: this is the same as fillPrice() where the skew is 0.
        int notionalValue = positionSize.mulDecimal(currentPrice.toInt());
        uint notionalAbsValue = MathUtil.abs(notionalValue);

        return
            MathUtil
                .abs(positionSize)
                .divDecimal(marketConfig.skewScale)
                .mulDecimal(notionalAbsValue)
                .mulDecimal(marketConfig.liquidationPremiumMultiplier);
    }
}
