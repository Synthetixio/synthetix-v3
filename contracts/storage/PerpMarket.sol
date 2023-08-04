//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpMarketConfiguration} from "./PerpMarketConfiguration.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PythStructs} from "../external/pyth/PythStructs.sol";
import {Order} from "./Order.sol";
import {Position} from "./Position.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

/**
 * @dev Storage for a specific perp market within the bfp-market.
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
        uint256 size;
        // The value of the funding rate last time this was computed.
        int256 currentFundingRateComputed;
        // The value (in native units) of total market funding accumulated.
        int256 currentFundingAccruedComputed;
        // block.timestamp of when funding was last computed.
        uint256 lastFundingTime;
        // {accountId: Order}.
        mapping(uint128 => Order.Data) orders;
        // {accountId: Position}.
        mapping(uint128 => Position.Data) positions;
        // {accountId: flaggerAddress}.
        mapping(uint128 => address) flaggedLiquidations;
        // block.timestamp of when a liquidation last occurred.
        uint256 lastLiquidationTime;
        // Size of accumulated liquidations in window relative to lastLiquidationTime.
        uint128 lastLiquidationUtilization;
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
    }

    /**
     * @dev Updates the Pyth price with the supplied off-chain update data for `pythPriceFeedId`.
     */
    function updatePythPrice(bytes[] calldata updateData) internal {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        globalConfig.pyth.updatePriceFeeds{value: msg.value}(updateData);
    }

    // --- Members (mutative) --- //

    /**
     * @dev Updates position for `data.accountId` with `data`.
     */
    function updatePosition(PerpMarket.Data storage self, Position.Data memory data) internal {
        self.positions[data.accountId].update(data);
    }

    /**
     * @dev Updates order for `data.accountId` with `data`.
     */
    function updateOrder(PerpMarket.Data storage self, Order.Data memory data) internal {
        self.orders[data.accountId].update(data);
    }

    /**
     * @dev Removes the order from the market at `accountId`.
     */
    function removeOrder(PerpMarket.Data storage self, uint128 accountId) internal {
        delete self.orders[accountId];
    }

    /**
     * @dev Recompute and store funding related values given the current market conditions.
     */
    function recomputeFunding(
        PerpMarket.Data storage self,
        uint256 price
    ) internal returns (int256 fundingRate, int256 fundingAccrued) {
        fundingRate = getCurrentFundingRate(self);
        fundingAccrued = getNextFunding(self, price);

        self.currentFundingRateComputed = fundingRate;
        self.currentFundingAccruedComputed = fundingAccrued;
        self.lastFundingTime = block.timestamp;
    }

    // --- Members (views) --- //

    /**
     * @dev Returns the latest oracle price from the preconfigured `oracleNodeId`.
     */
    function getOraclePrice(PerpMarket.Data storage self) internal view returns (uint256 price) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(self.id);
        price = globalConfig.oracleManager.process(marketConfig.oracleNodeId).price.toUint();
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
        uint256 maxAge = (commitmentTime.toInt() + globalConfig.minOrderAge.toInt() + globalConfig.pythPublishTimeMax)
            .toUint();
        PythStructs.Price memory latestPrice = globalConfig.pyth.getPriceNoOlderThan(
            marketConfig.pythPriceFeedId,
            maxAge
        );

        // How to calculate the Pyth price:
        //
        // latestPrice.price fixed-point representation base
        // latestPrice.expo  fixed-point representation exponent (to go from base to decimal)
        // latestPrice.conf  fixed-point representation of confidence
        //
        // price = 12276250
        // expo = -5
        // price = 12276250 * 10^(-5) =  122.76250
        //
        // 18 decimals => rebasedPrice = 12276250 * 10^(18-5) = 122762500000000000000
        uint256 baseConvertion = 10 ** uint(int(18) + latestPrice.expo);
        price = (latestPrice.price * int(baseConvertion)).toUint();
        publishTime = latestPrice.publishTime;
    }

    /**
     * @dev Returns the rate of funding rate change.
     */
    function getCurrentFundingVelocity(PerpMarket.Data storage self) internal view returns (int256) {
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(self.id);

        int128 maxFundingVelocity = marketConfig.maxFundingVelocity.toInt();
        int128 skewScale = marketConfig.skewScale.toInt();
        int128 skew = self.skew;

        // Avoid a panic due to div by zero. Return 0 immediately.
        if (skewScale == 0) {
            return 0;
        }

        // Ensures the proportionalSkew is between -1 and 1.
        int256 pSkew = skew.divDecimal(skewScale);
        int256 pSkewBounded = MathUtil.min(
            MathUtil.max(-(DecimalMath.UNIT).toInt(), pSkew),
            (DecimalMath.UNIT).toInt()
        );
        return pSkewBounded.mulDecimal(maxFundingVelocity);
    }

    /**
     * @dev Returns the proportional time elapsed since last funding (proportional by 1 day).
     */
    function getProportionalElapsed(PerpMarket.Data storage self) internal view returns (int256) {
        return (block.timestamp - self.lastFundingTime).toInt().divDecimal(1 days);
    }

    /**
     * @dev Returns the current funding rate given current market conditions.
     *
     * This is used during funding computation _before_ the market is modified (e.g. closing or
     * opening a position). However, called via the `currentFundingRate` view, will return the
     * 'instantaneous' funding rate. It's similar but subtle in that velocity now includes the most
     * recent skew modification.
     *
     * There is no variance in computation but will be affected based on outside modifications to
     * the market skew, max funding velocity, price, and time delta.
     */
    function getCurrentFundingRate(PerpMarket.Data storage self) internal view returns (int256) {
        // calculations:
        //  - velocity          = proportional_skew * max_funding_velocity
        //  - proportional_skew = skew / skew_scale
        //
        // example:
        //  - prev_funding_rate     = 0
        //  - velocity              = 0.0025
        //  - time_delta            = 29,000s
        //  - max_funding_velocity  = 0.025 (2.5%)
        //  - skew                  = 300
        //  - skew_scale            = 10,000
        //
        // funding_rate = prev_funding_rate + velocity * (time_delta / seconds_in_day)
        // funding_rate = 0 + 0.0025 * (29,000 / 86,400)
        //              = 0 + 0.0025 * 0.33564815
        //              = 0.00083912
        return
            self.currentFundingRateComputed +
            (getCurrentFundingVelocity(self).mulDecimal(getProportionalElapsed(self)));
    }

    /**
     * @dev Returns the next market funding accrued value.
     */
    function getNextFunding(PerpMarket.Data storage self, uint256 price) internal view returns (int256) {
        int256 fundingRate = getCurrentFundingRate(self);
        // The minus sign is needed as funding flows in the opposite direction to skew.
        int256 avgFundingRate = -(self.currentFundingRateComputed + fundingRate).divDecimal(
            (DecimalMath.UNIT * 2).toInt()
        );
        // Calculate the additive accrued funding delta for the next funding accrued value.
        int256 unrecordedFunding = avgFundingRate.mulDecimal(getProportionalElapsed(self)).mulDecimal(price.toInt());
        return self.currentFundingAccruedComputed + unrecordedFunding;
    }

    /**
     * @dev Returns the max amount in size we can liquidate now. Zero if limit has been reached.
     */
    function getRemainingLiquidatableCapacity(PerpMarket.Data storage self) internal view returns (uint128 capacity) {
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(self.id);

        // NOTE: This feels wrong but I'm going off v3 implementation until fifa gets back with
        // response.
        //
        // 100,000         skewScale
        // 0.0002 / 0.0006 {maker,taker}Fee
        // 1               scalar
        // 2000            maxMarketSize
        // 30s             window
        //
        // maxLiquidatableCapacity = (0.0002 + 0.0006) * 100000 * 30
        //                         = 2400
        //                         = ??? huh
        uint128 maxLiquidatableCapacity = uint128(marketConfig.makerFee + marketConfig.takerFee)
            .mulDecimal(marketConfig.skewScale)
            .mulDecimal(marketConfig.liquidationLimitScalar)
            .mulDecimal(marketConfig.liquidationWindowDuration)
            .to128();
        capacity = block.timestamp - self.lastLiquidationTime > marketConfig.liquidationWindowDuration
            ? maxLiquidatableCapacity
            : MathUtil.max((maxLiquidatableCapacity - self.lastLiquidationUtilization).toInt(), 0).toUint().to128();
    }
}
