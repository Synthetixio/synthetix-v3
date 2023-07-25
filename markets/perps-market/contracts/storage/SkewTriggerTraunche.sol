//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";
import {SettlementStrategy} from "./SettlementStrategy.sol";
import {Position} from "./Position.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {PerpsAccount} from "./PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PriceUtil} from "../utils/PriceUtil.sol";
import {OrderFee} from "./OrderFee.sol";

import "@synthetixio/core/contracts/storage/Distribution.sol";

/**
 * @title Async order top level data storage
 */
library SkewTriggerTraunche {
    using DecimalMath for int256;
    using DecimalMath for int128;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using PerpsMarket for PerpsMarket.Data;
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;
    using Distribution for Distribution.Data;

    /**
     * @notice Thrown when there's not enough margin to cover the order and settlement costs associated.
     */
    error InsufficientMargin(int availableMargin, uint minMargin);

    struct Data {
        /**
         * The accounts which the resulting trade effects will be distributed into
         */
        Distribution.Data dist;
    }

    function load(uint128 marketId, int256 idx) internal pure returns (Data storage self) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.SkewTriggerTraunche", marketId, idx));

        assembly {
            self.slot := s
        }
    }

    function applyAccountContribution(Data storage self, uint128 accountId, uint256 size) internal {
        bytes32 actorId = bytes32(uint256(accountId));
        self.dist.setActorShares(actorId, size);
    }

    /**
     * Update the position in response to a new market position.
     * @param self self
     * @param portion D18 representing the ratio of the way through the current traunche. Used to affect the current order size
     */
    function applyPosition(Data storage self, uint128 marketId, uint256 portion) internal returns (uint256 accumulatedPnl) {
        if (portion == 0) {
            return clearPosition(self, marketId);
        }

        accumulate(self);

        PerpsMarket.Data storage perpsMarketData = PerpsMarket.loadValid(marketId);


        // TODO: if there are to be fees for people using this type of order, this is where they would be put
        uint256 fillPrice = PriceUtil.calculateFillPrice(
            perpsMarketData.skew,
            marketConfig.skewScale,
            0,
            0
        );

        uint newPositionSize = portion.mulDecimal(self.size);

        Position.Data memory newPosition = Position.Data({
            marketId: marketId,
            latestInteractionPrice: fillPrice.to128(),
            latestInteractionFunding: perpsMarketData.lastFundingValue.to128(),
            size: newPositionSize
        });

        PerpsMarket.MarketUpdateData memory updateData = perpsMarketData.updatePositionData(getTrauncheAccountId(self), newPosition);
    }

    /**
     * Remove the position. Called when the order traunche has gone out of range
     * @param self self
     */
    function clearPosition(Data storage self, uint128 marketId) internal returns (uint256 accumulatedPnl) {
        accumulate(self);

        Position.Data memory newPosition = Position.Data({
            marketId: 0,
            latestInteractionPrice: 0,
            latestInteractionFunding: 0,
            size: 0
        });

        PerpsMarket.MarketUpdateData memory updateData = PerpsMarket
            .loadValid(marketId)
            .updatePositionData(getTrauncheAccountId(self), newPosition);
    }

    /**
     * Called prior to updating the order *or* needing the latest profit/loss for a order change
     * @param self self
     */
    function accumulate(Data storage self) internal returns (int256 accumulatedPnl) {
        uint256 trauncheAccountId = getTrauncheAccountId(self);

        Position.Data storage oldPosition = PerpsMarket.load(order.marketId).positions[trauncheAccountId];

        if (oldPosition.size == 0) {
            return 0;
        }

        PriceUtil.calculateFillPrice(
            perpsMarketData.skew,
            marketConfig.skewScale,
            0,
            0
        );

        (accumulatedPnl, , , ) = oldPosition.getPnl(fillPrice);

        dist.distribute(accumulatedPnl);
    }

    /**
     * Traunche's open new positions as the skew moves. This affects the "new" skew after a market style order is opened
     * To compute this new skew, here is the function
     */
    function calculateNewSkew(uint128 marketId, int256 currentSkew, uint256 skewScale, int256 addedSize) internal view returns (int256 newSkew) {
        int256 remainingSize = addedSize;
        int256 idx = getTrauncheIndex(currentSkew / skewScale);
        newSkew = currentSkew;
        while (remainingSize != 0) {
            Data storage traunche = load(marketId, idx);
            (int256 trauncheStart, uint256 trauncheLen) = getTrauncheProperties(idx);

            // calculate the amount required to get to the "edge" of the traunche (aka either fully closed or fully open)
            int256 trauncheSizeRemaining;
            uint256 targetSkew;
            if (MathUtil.sameSide(scaledSkew, remainingSize)) {
                // when at top of traunche, position is fully open
                targetSkew = (trauncheStart + trauncheLen).mulDecimal(skewScale);
                trauncheOpenSize = (targetSkew - newSkew) * traunche.dist.totalSharesD18 / trauncheLen.mulDecimal(skewScale);
                trauncheSizeRemaining = trauncheOpenSize + targetSkew - newSkew;
            } else {
                // when at the buttom of the traunche, then this position is fully closed, but scale still needs to be met
                targetSkew = trauncheStart.mulDecimal(skewScale);
                trauncheClosedSize = (newSkew - trauncheStart.mulDecimal(skewScale)) * traunche.dist.totalSharesD18 / trauncheLen.mulDecimal(skewScale);
                trauncheSizeRemaining = trauncheClosedSize + newSkew - targetSkew;
            }

            if (Math.abs(trauncheSizeRemaining) > Math.abs(remainingSize)) {
                 // only part of this traunche will be used, and it will result in a new skew somewhere inside the traunche range
                 newSkew = newSkew + (trauncheLen.mulDecimal(skewScale) * remainingSize / trauncheSizeRemaining);
                 remainingSize = 0;
            } else {
                newSkew = targetSkew;
                remainingSize -= trauncheSizeRemaining;
            }
        }
    }

    function getTrauncheAccountId(Data storage self) internal pure returns (uint256) {
        bytes32 s;

        assembly {
            s := self.slot
        }

        return uint256(s) & (0x1 << 255);
    }

    function getTrauncheIndex(int256 skew, uint256 maxTraunches) internal pure returns (int256) {
        uint256 cur = 1e18;
        uint idx;

        for (;cur > MathUtil.abs(skew) && idx < maxTraunches;idx++) {
            cur.divDecimal(factor);
        }

        return maxTraunches - idx;
    }

    function getTrauncheProperties(int256 idx, uint256 maxTraunches) internal pure returns (int256 start, uint256 len) {
        // 0 = 0, 2/1024
        // 1 = 2/1024, 1/512
        // 2 = 4/1024, 1/256
        // 3 = 8/1024, 1/128

        uint baseTrauncheSize = MathUtil.pow(2, -maxTraunches.toInt());

        if (idx == 0) {
            // this traunche is special
            return (0, baseTrauncheSize * 2);
        }

        start = baseTrauncheSize * MathUtil.pow(2, idx);
        len = 1e18 / MathUtil.pow(2, baseTrauncheSize - MathUtil.abs(idx));
    }
}
