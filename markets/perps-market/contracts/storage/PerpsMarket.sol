//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "./PerpsAccount.sol";
import "./Position.sol";
import "./AsyncOrder.sol";
import "./MarketConfiguration.sol";
import "../utils/MathUtil.sol";
import "./SettlementStrategy.sol";
import "./OrderFee.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

/**
 * @title Data for a single perps market
 */
library PerpsMarket {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;

    struct Data {
        address owner;
        address nominatedOwner;
        string name;
        string symbol;
        uint128 id;
        int256 skew;
        uint256 size;
        // TODO: move to new data structure?
        int lastFundingRate;
        int lastFundingValue;
        uint256 lastFundingTime;
        // liquidation params
        uint128 lastTimeLiquidationCapacityUpdated;
        uint128 lastUtilizedLiquidationCapacity;
        // accountId => asyncOrder
        mapping(uint => AsyncOrder.Data) asyncOrders;
        // accountId => position
        mapping(uint => Position.Data) positions;
    }

    function create(uint128 id) internal returns (Data storage market) {
        market = load(id);
        market.id = id;
    }

    function load(uint128 marketId) internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.PerpsMarket", marketId));

        assembly {
            market.slot := s
        }
    }

    function maxLiquidatableAmount(uint128 marketId) internal returns (uint) {
        Data storage self = load(marketId);
        uint maxLiquidationValue = maxLiquidationPerSecond(marketId);
        uint timeSinceLastUpdate = block.timestamp - self.lastTimeLiquidationCapacityUpdated;

        self.lastTimeLiquidationCapacityUpdated = block.timestamp.to128();
        uint unlockedLiquidationCapacity = timeSinceLastUpdate * maxLiquidationValue;
        if (unlockedLiquidationCapacity > self.lastUtilizedLiquidationCapacity) {
            self.lastUtilizedLiquidationCapacity = 0;
        } else {
            self.lastUtilizedLiquidationCapacity =
                self.lastUtilizedLiquidationCapacity -
                unlockedLiquidationCapacity.to128();
        }

        return
            (maxLiquidationValue *
                MarketConfiguration.load(marketId).maxLiquidationLimitAccumulationMultiplier) -
            self.lastUtilizedLiquidationCapacity;
    }

    function maxLiquidationPerSecond(uint128 marketId) internal view returns (uint) {
        MarketConfiguration.Data storage marketConfig = MarketConfiguration.load(marketId);
        OrderFee.Data storage orderFeeData = marketConfig.orderFees[
            MarketConfiguration.OrderType.ASYNC_OFFCHAIN
        ];
        return (orderFeeData.makerFee + orderFeeData.takerFee).mulDecimal(marketConfig.skewScale);
    }

    function updatePositionData(Data storage self, Position.Data memory newPosition) internal {
        self.size += MathUtil.abs(newPosition.size);
        self.skew += newPosition.size;
    }

    function loadWithVerifiedOwner(
        uint128 id,
        address possibleOwner
    ) internal view returns (Data storage market) {
        market = load(id);

        if (market.owner != possibleOwner) {
            revert AccessError.Unauthorized(possibleOwner);
        }
    }

    function recomputeFunding(
        Data storage self,
        uint price
    ) internal returns (int fundingRate, int fundingValue) {
        fundingRate = currentFundingRate(self);
        fundingValue = calculateNextFunding(self, price);

        self.lastFundingRate = fundingRate;
        self.lastFundingValue = fundingValue;
        self.lastFundingTime = block.timestamp;

        return (fundingRate, fundingValue);
    }

    function calculateNextFunding(
        Data storage self,
        uint price
    ) internal view returns (int nextFunding) {
        nextFunding = self.lastFundingValue + unrecordedFunding(self, price);
    }

    function unrecordedFunding(Data storage self, uint price) internal view returns (int) {
        int fundingRate = currentFundingRate(self);
        // note the minus sign: funding flows in the opposite direction to the skew.
        int avgFundingRate = -(self.lastFundingRate + fundingRate).divDecimal(
            (DecimalMath.UNIT * 2).toInt()
        );
        return avgFundingRate.mulDecimal(proportionalElapsed(self)).mulDecimal(price.toInt());
    }

    function currentFundingRate(Data storage self) internal view returns (int) {
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

        return
            (self.lastFundingRate + currentFundingVelocity(self)).mulDecimal(
                proportionalElapsed(self)
            );
    }

    function currentFundingVelocity(Data storage self) internal view returns (int) {
        MarketConfiguration.Data storage marketConfig = MarketConfiguration.load(self.id);
        int maxFundingVelocity = marketConfig.maxFundingVelocity.toInt();
        int pSkew = self.skew.divDecimal(marketConfig.skewScale.toInt());
        // Ensures the proportionalSkew is between -1 and 1.
        int proportionalSkew = MathUtil.min(
            MathUtil.max(-(DecimalMath.UNIT).toInt(), pSkew),
            (DecimalMath.UNIT).toInt()
        );
        return proportionalSkew.mulDecimal(maxFundingVelocity);
    }

    function proportionalElapsed(Data storage self) internal view returns (int) {
        return (block.timestamp - self.lastFundingTime).toInt().divDecimal(1 days);
    }

    // TODO: David will refactor this
    function orderSizeTooLarge(
        Data storage self,
        uint maxSize,
        int oldSize,
        int newSize
    ) internal view returns (bool) {
        // Allow users to reduce an order no matter the market conditions.
        if (MathUtil.sameSide(oldSize, newSize) && MathUtil.abs(newSize) <= MathUtil.abs(oldSize)) {
            return false;
        }

        // Either the user is flipping sides, or they are increasing an order on the same side they're already on;
        // we check that the side of the market their order is on would not break the limit.
        int newSkew = self.skew - oldSize + newSize;
        int newMarketSize = self.size.toInt() -
            MathUtil.abs(oldSize).toInt() +
            MathUtil.abs(newSize).toInt();

        int newSideSize;
        if (0 < newSize) {
            // long case: marketSize + skew
            //            = (|longSize| + |shortSize|) + (longSize + shortSize)
            //            = 2 * longSize
            newSideSize = newMarketSize + newSkew;
        } else {
            // short case: marketSize - skew
            //            = (|longSize| + |shortSize|) - (longSize + shortSize)
            //            = 2 * -shortSize
            newSideSize = newMarketSize - newSkew;
        }

        // newSideSize still includes an extra factor of 2 here, so we will divide by 2 in the actual condition
        if (maxSize < MathUtil.abs(newSideSize / 2)) {
            return true;
        }

        return false;
    }
}
