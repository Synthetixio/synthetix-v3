//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "./PerpMarketConfiguration.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {Margin} from "./Margin.sol";
import {Order} from "./Order.sol";
import {Position} from "./Position.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PythStructs} from "../external/pyth/PythStructs.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

/**
 * @dev A single perp market denoted by marketId within bfp-market.
 *
 * As of writing this, there will _only be one_ perp market (i.e. wstETH) however, this allows
 * bfp-market to extend to allow more in the future.
 *
 * We track the marketId here because each PerpMarket is a separate market in Synthetix core.
 */
library PerpMarket {
    using DecimalMath for int128;
    using DecimalMath for uint128;
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastU128 for uint128;
    using Position for Position.Data;
    using Order for Order.Data;

    // --- Storage --- //

    struct Data {
        // A unique market id for market reference.
        uint128 id;
        // Human readable name e.g. bytes32(WSTETHPERP).
        bytes32 name;
        // sum(positions.map(p => p.size)).
        int128 skew;
        // sum(positions.map(p => abs(p.size))).
        uint128 size;
        // The value of the funding rate last time this was computed.
        int256 currentFundingRateComputed;
        // The value (in native units) of total market funding accumulated.
        int256 currentFundingAccruedComputed;
        // block.timestamp of when funding was last computed.
        uint256 lastFundingTime;
        // This is needed to perform a fast constant time op for overall market debt.
        //
        // debtCorrection = positions.sum(p.collateralUsd - p.size * (p.entryPrice + p.entryFunding))
        // marketDebt     = market.skew * (price + nextFundingEntry) + debtCorrection
        int128 debtCorrection;
        // {accountId: Order}.
        mapping(uint128 => Order.Data) orders;
        // {accountId: Position}.
        mapping(uint128 => Position.Data) positions;
        // {accountId: flaggerAddress}.
        mapping(uint128 => address) flaggedLiquidations;
        // {synthMarketId: collateralAmount} (# collateral deposited to market).
        mapping(uint128 => uint256) depositedCollateral;
        // An infinitely growing array of tuples [(timestamp, size), ...] to track liq caps.
        uint128[2][] pastLiquidations;
    }

    function load(uint128 id) internal pure returns (Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarket", id));

        assembly {
            d.slot := s
        }
    }

    /**
     * @dev Reverts if the market does not exist. Otherwise, returns the market.
     */
    function exists(uint128 id) internal view returns (Data storage market) {
        Data storage self = load(id);
        if (self.id == 0) {
            revert ErrorUtil.MarketNotFound(id);
        }
        return self;
    }

    /**
     * @dev Creates a market by updating storage for at `id`.
     */
    function create(uint128 id, bytes32 name) internal {
        PerpMarket.Data storage market = load(id);
        market.id = id;
        market.name = name;

        // @dev Init the pastLiquidations with an empty liquidation chunk for easier remainingCapacity check.
        market.pastLiquidations.push([0, 0]);
    }

    /**
     * @dev Updates the Pyth price with the supplied off-chain update data for `pythPriceFeedId`.
     */
    function updatePythPrice(bytes[] calldata updateData) internal {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        globalConfig.pyth.updatePriceFeeds{value: msg.value}(updateData);
    }

    // --- Member (mutative) --- //

    /**
     * @dev Updates the debt correction given an `oldPosition` and `newPosition`.
     */
    function updateDebtCorrection(
        PerpMarket.Data storage self,
        Position.Data storage oldPosition,
        Position.Data memory newPosition
    ) internal {
        int256 sizeDelta = newPosition.size - oldPosition.size;
        int256 fundingDelta = newPosition.entryFundingAccrued.mulDecimal(sizeDelta);
        int256 notionalDelta = newPosition.entryPrice.toInt().mulDecimal(sizeDelta);
        int256 totalPositionPnl = oldPosition.getPnl(newPosition.entryPrice) +
            oldPosition.getAccruedFunding(self, newPosition.entryPrice) +
            newPosition.accruedFeesUsd.toInt();

        self.debtCorrection += (fundingDelta + notionalDelta + totalPositionPnl).to128();
    }

    /**
     * @dev Updates the `pastLiquidations` array by either appending a new timestamp or
     */
    function updateAccumulatedLiquidation(PerpMarket.Data storage self, uint128 liqSize) internal {
        uint128 currentTime = block.timestamp.to128();
        uint256 length = self.pastLiquidations.length;

        // Most recent liquidation is the same timestamp (multi liquidation tx in same block), accumulate.
        uint128[2] storage pastLiquidation = self.pastLiquidations[length - 1];
        if (pastLiquidation[0] == block.timestamp) {
            // Add the liqSize to the same chunk.
            self.pastLiquidations[length - 1][1] += liqSize;
        } else {
            // A new timestamp (block) to be chunked.
            self.pastLiquidations.push([currentTime, liqSize]);
        }
    }

    /**
     * @dev Recompute and store funding related values given the current market conditions.
     */
    function recomputeFunding(
        PerpMarket.Data storage self,
        uint256 price
    ) internal returns (int256 fundingRate, int256 fundingAccrued) {
        (fundingRate, fundingAccrued) = getUnrecordedFundingWithRate(self, price);

        self.currentFundingRateComputed = fundingRate;
        self.currentFundingAccruedComputed = fundingAccrued;
        self.lastFundingTime = block.timestamp;
    }

    // --- Member (views) --- //

    /**
     * @dev Returns the latest oracle price from the preconfigured `oracleNodeId`.
     */
    function getOraclePrice(PerpMarket.Data storage self) internal view returns (uint256) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(self.id);
        return globalConfig.oracleManager.process(marketConfig.oracleNodeId).price.toUint();
    }

    /**
     * @dev Returns the 'latest' Pyth price from the oracle predefined `pythPriceFeedId` between min/max.
     */
    function getPythPrice(
        PerpMarket.Data storage self,
        uint256 commitmentTime
    ) internal view returns (uint256 price, uint256 publishTime) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(self.id);

        // @see: external/pyth/IPyth.sol for more details.
        uint256 maxAge = commitmentTime + globalConfig.pythPublishTimeMax;
        PythStructs.Price memory latestPrice = globalConfig.pyth.getPriceNoOlderThan(
            marketConfig.pythPriceFeedId,
            maxAge
        );

        // @see: synthetix-v3/protocol/oracle-manager/contracts/nodes/PythNode.sol
        int256 factor = 18 + latestPrice.expo;
        price = (
            factor > 0 ? latestPrice.price.upscale(factor.toUint()) : latestPrice.price.downscale((-factor).toUint())
        ).toUint();
        publishTime = latestPrice.publishTime;
    }

    /**
     * @dev Returns the rate of funding rate change.
     */
    function getCurrentFundingVelocity(PerpMarket.Data storage self) internal view returns (int256) {
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(self.id);
        int128 skewScale = marketConfig.skewScale.toInt();

        // Avoid a panic due to div by zero. Return 0 immediately.
        if (skewScale == 0) {
            return 0;
        }

        // Ensures the proportionalSkew is between -1 and 1.
        int256 pSkew = self.skew.divDecimal(skewScale);
        int256 pSkewBounded = MathUtil.min(
            MathUtil.max(-(DecimalMath.UNIT).toInt(), pSkew),
            (DecimalMath.UNIT).toInt()
        );

        return pSkewBounded.mulDecimal(marketConfig.maxFundingVelocity.toInt());
    }

    /**
     * @dev Returns the proportional time elapsed since last funding (proportional by 1 day).
     */
    function getProportionalElapsed(PerpMarket.Data storage self) internal view returns (int256) {
        return (block.timestamp - self.lastFundingTime).toInt().divDecimal(1 days);
    }

    /**
     * @dev Returns the current funding rate given current market conditions.
     */
    function getCurrentFundingRate(PerpMarket.Data storage self) internal view returns (int256) {
        // calculations:
        //  - proportionalSkew = skew / skewScale
        //  - velocity          = proportionalSkew * maxFundingVelocity
        //
        // example:
        //  - fundingRate         = 0
        //  - velocity            = 0.0025
        //  - timeDelta           = 29,000s
        //  - maxFundingVelocity  = 0.025 (2.5%)
        //  - skew                = 300
        //  - skewScale           = 10,000
        //
        // currentFundingRate = fundingRate + velocity * (timeDelta / secondsInDay)
        // currentFundingRate = 0 + 0.0025 * (29,000 / 86,400)
        //                    = 0 + 0.0025 * 0.33564815
        //                    = 0.00083912
        return
            self.currentFundingRateComputed +
            (getCurrentFundingVelocity(self).mulDecimal(getProportionalElapsed(self)));
    }

    /**
     * @dev Returns the next market funding accrued value.
     */
    function getUnrecordedFundingWithRate(
        PerpMarket.Data storage self,
        uint256 price
    ) internal view returns (int256 fundingRate, int256 unrecordedFunding) {
        fundingRate = getCurrentFundingRate(self);
        // The minus sign is needed as funding flows in the opposite direction to skew.
        int256 avgFundingRate = -(self.currentFundingRateComputed + fundingRate).divDecimal(
            (DecimalMath.UNIT * 2).toInt()
        );
        // Calculate the additive accrued funding delta for the next funding accrued value.
        unrecordedFunding = avgFundingRate.mulDecimal(getProportionalElapsed(self)).mulDecimal(price.toInt());
    }

    /**
     * @dev Returns the max amount in size we can liquidate now. Zero if limit has been reached.
     */
    function getRemainingLiquidatableSizeCapacity(
        PerpMarket.Data storage self,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint128 maxLiquidatableCapacity, uint128 remainingCapacity, uint128 lastLiquidationTime) {
        // How do we calculcate `maxLiquidatableCapacity`?
        //
        // As an example, assume the following example parameters for a ETH/USD market.
        //
        // 100,000         skewScale
        // 0.0002 / 0.0006 {maker,taker}Fee
        // 1               scalar
        // 30s             window
        //
        // maxLiquidatableCapacity = (0.0002 + 0.0006) * 100000 * 1
        //                         = 80
        maxLiquidatableCapacity = uint128(marketConfig.makerFee + marketConfig.takerFee)
            .mulDecimal(marketConfig.skewScale)
            .mulDecimal(marketConfig.liquidationLimitScalar)
            .to128();

        // How is the liquidation cap inferred?
        //
        // Suppose we track an infinitely growing array of tuples in the form:
        //
        // [(timestamp, size), (timestamp, size), ... (timestamp, size)]
        //
        // Where timestamp is the `block.timestamp` at which a liqudation (partial or full) had occurred and
        // `size` is the amount of native units that was liquidated at that time. Many liquidations can
        // occur in a single block, so `size` is also the accumulation tokens liquidated by timestamp.
        //
        // Additionally, we also have the following information (1) current block.timestamp, (2) necessary details
        // to calculcate `maxLiquidatableCapacity` (maximum size that can be liquidated within a single window), and
        // (3) seconds per window.
        //
        // To calculate how much size has already been liquidated in the current window, sum over all `size` where
        // `timestamp` is gt current `block.timestamp` - `secondsInWindow`. If the sum is larger than `maxLiquidatableCapacity`
        // then we have reached cap, if not there is more size to utilize.
        //
        // As a concrete example,
        //
        // pastLiquidations      = [(12, 6), (24, 10), (36, 25), (60, 100)]
        // secondsInWindow       = 48
        // currentBlockTimestamp = 72
        //
        // windowStartTime = 72 - secondsInWindow
        //                 = 72 - 48
        //                 = 24
        //
        // remCapacity = [(12, 6), (24, 10), (36, 25), (60, 100)]
        //             = [(36, 25), (60, 100)]
        //             = sum([25, 100])
        //             = 125

        // Start from the end of the array and go backwards until we've hit timestamp > windowStartTimestamp.
        uint256 idx = self.pastLiquidations.length - 1;

        // There has been at least one liquidation.
        lastLiquidationTime = self.pastLiquidations[idx][0];

        // Accumulative sum over all prior liquidations within `windowStartTime` to now.
        uint256 capacityUtilized;

        // Infer the _rolling_ window start time by reading the current block.timestamp.
        uint128 windowStartTime = (block.timestamp - marketConfig.liquidationWindowDuration).to128();

        // Starting from the end until we reach the beginning or until block.timestamp is no longer within window.
        while (self.pastLiquidations[idx][0] > windowStartTime) {
            capacityUtilized += self.pastLiquidations[idx][1];

            if (idx == 0) {
                break;
            }

            unchecked {
                --idx;
            }
        }

        // Ensure remainingCapacity can never be negative during times where cap was exceeded due to maxPd bypass or
        // endorsed keeper bypass.
        remainingCapacity = MathUtil
            .max((maxLiquidatableCapacity.toInt() - capacityUtilized.toInt()), 0)
            .toUint()
            .to128();
    }

    /**
     * @dev Returns the total USD value of all collaterals if we were to spot sell everything.
     */
    function getTotalCollateralValueUsd(PerpMarket.Data storage self) internal view returns (uint256) {
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        uint128 synthMarketId;
        uint256 totalValueUsd;
        uint256 available;

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        for (uint256 i = 0; i < length; ++i) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            available = self.depositedCollateral[synthMarketId];

            if (available == 0) {
                continue;
            }

            if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
                totalValueUsd += self.depositedCollateral[synthMarketId];
            } else {
                (uint256 amountUsd, ) = globalConfig.spotMarket.quoteSellExactIn(synthMarketId, available);
                totalValueUsd += amountUsd;
            }
        }

        return totalValueUsd;
    }
}
