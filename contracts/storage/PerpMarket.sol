//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {Order} from "./Order.sol";
import {Position} from "./Position.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpMarketFactoryConfiguration} from "./PerpMarketFactoryConfiguration.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

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
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastU128 for uint128;

    // --- Errors --- //

    error MarketNotFound(uint128 id);

    // --- Storage --- //

    struct Data {
        // A unique market id for market reference.
        uint128 id;
        // Semi readable key e.g. bytes32(WSTETHPERP) for this market.
        bytes32 key;
        // sum(positions.map(p => p.size)).
        int128 skew;
        // sum(positions.map(p => abs(p.size))).
        uint256 size;
        // The value of the funding rate last time this was computed.
        int256 fundingRateLastComputed;
        // The value (in native units) of total market funding accumulated.
        int256 fundingAccruedLastComputed;
        // block.timestamp of when funding was last computed.
        uint256 lastFundingTime;
        // {accountId: Order}.
        mapping(uint128 => Order.Data) orders;
        // {accountId: Position}.
        mapping(uint128 => Position.Data) positions;
        // {collateralAddress: totalDeposited}
        mapping(address => uint256) totalCollateralDeposited;
        // TODO: Move these config params into a PerpMarketConfiguration.sol storage lib.
        // Oracle node id for price feed data.
        bytes32 oracleNodeId;
        // Skew scaling denominator constant.
        uint128 skewScale;
        // Fee paid (in bps) when the order _decreases_ skew.
        uint128 makerFee;
        // Fee paid (in bps) when the order _increases_ skew.
        uint128 takerFee;
        // The maximum velocity funding rate can change by.
        uint128 maxFundingVelocity;
        // The minimum amount in USD a keeper should receive on any executions/liquidations.
        uint256 minKeeperFeeUsd;
        // The maximum amount in USD a keeper should receive on any executions/liquidations.
        uint256 maxKeeperFeeUsd;
    }

    function load(uint128 id) internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarket", id));

        assembly {
            market.slot := s
        }
    }

    /**
     * @dev Reverts if the market does not exist with appropriate error. Otherwise, returns the market.
     */
    function exists(uint128 id) internal view returns (Data storage market) {
        Data storage self = load(id);
        if (self.id == 0) {
            revert MarketNotFound(id);
        }
        return self;
    }

    // --- Members --- //

    /**
     * @dev Returns the latest oracle price from the pre-configured `oracleNodeId`.
     */
    function oraclePrice(PerpMarket.Data storage self) internal view returns (uint256 price) {
        PerpMarketFactoryConfiguration.Data storage config = PerpMarketFactoryConfiguration.load();
        price = INodeModule(config.oracleManager).process(self.oracleNodeId).price.toUint();
    }

    /**
     * @dev Returns the rate of funding rate change.
     */
    function currentFundingVelocity(PerpMarket.Data storage self) internal view returns (int256) {
        int128 maxFundingVelocity = self.maxFundingVelocity.toInt();
        int128 skewScale = self.skewScale.toInt();

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
        return pSkewBounded.mulDecimal(maxFundingVelocity);
    }

    /**
     * @dev Returns the proportional time elapsed since last funding (proportional by 1 day).
     */
    function proportionalElapsed(PerpMarket.Data storage self) internal view returns (int256) {
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
    function currentFundingRate(PerpMarket.Data storage self) internal view returns (int256) {
        // calculations:
        //  - velocity          = proportional_skew * max_funding_velocity
        //  - proportional_skew = skew / skew_scale
        //
        // example:
        //  - prev_funding_rate     = 0
        //  - prev_velocity         = 0.0025
        //  - time_delta            = 29,000s
        //  - max_funding_velocity  = 0.025 (2.5%)
        //  - skew                  = 300
        //  - skew_scale            = 10,000
        //
        // note: prev_velocity just refs to the velocity _before_ modifying the market skew.
        //
        // funding_rate = prev_funding_rate + prev_velocity * (time_delta / seconds_in_day)
        // funding_rate = 0 + 0.0025 * (29,000 / 86,400)
        //              = 0 + 0.0025 * 0.33564815
        //              = 0.00083912
        return self.fundingRateLastComputed + (currentFundingVelocity(self).mulDecimal(proportionalElapsed(self)));
    }

    function unrecordedFunding(PerpMarket.Data storage self, uint256 _oraclePrice) internal view returns (int256) {
        int256 fundingRate = currentFundingRate(self);

        // NOTE: The minus sign - funding flows in the opposite direction to skew.
        int256 avgFundingRate = -(self.fundingRateLastComputed + fundingRate).divDecimal(
            (DecimalMath.UNIT * 2).toInt()
        );
        return avgFundingRate.mulDecimal(proportionalElapsed(self)).mulDecimal(_oraclePrice.toInt());
    }

    function nextFunding(PerpMarket.Data storage self, uint256 _oraclePrice) internal view returns (int256) {
        return self.fundingAccruedLastComputed + unrecordedFunding(self, _oraclePrice);
    }

    function recomputeFunding(
        PerpMarket.Data storage self,
        uint256 _oraclePrice
    ) internal returns (int256 fundingRate, int256 fundingAccrued) {
        fundingRate = currentFundingRate(self);
        fundingAccrued = self.fundingAccruedLastComputed + unrecordedFunding(self, _oraclePrice);

        self.fundingRateLastComputed = fundingRate;
        self.fundingAccruedLastComputed = fundingAccrued;
        self.lastFundingTime = block.timestamp;

        // TODO: Emit FundingRecomputed event.
    }
}
