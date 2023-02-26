//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./Account.sol";
import "./Position.sol";
import "./AsyncOrder.sol";
import "./MarketConfiguration.sol";
import "../utils/MathUtil.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

/**
 * @title Data for a single perps market
 */
library PerpsMarket {
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
        int lastFundingVelocity;
        uint256 lastFundingTime;
        // accountId => asyncOrder
        mapping(uint => AsyncOrder.Data) asyncOrders;
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

    function unrecordedFunding(Data storage self, uint price) internal view returns (int) {
        // note the minus sign: funding flows in the opposite direction to the skew.
        int avgFundingRate = -(int(self.latestFundingRate).add(currentFundingRate(self)))
            .divDecimal(DecimalMath.UNIT * 2);
        return avgFundingRate.mulDecimal(proportionalElapsed(self)).mulDecimal(int(price));
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
            int(self.lastFundingRate).add(
                currentFundingVelocity(self).mulDecimal(proportionalElapsed(self))
            );
    }

    function currentFundingVelocity(Data storage self) internal view returns (int) {
        MarketConfiguration.Data storage marketConfig = MarketConfiguration.load(self.id);
        int maxFundingVelocity = int(marketConfig.maxFundingVelocity);
        int pSkew = int(self.skew).divDecimal(int(marketConfig.skewScale));
        // Ensures the proportionalSkew is between -1 and 1.
        int proportionalSkew = MathUtil.min(
            MathUtil.max(-DecimalMath.UNIT, pSkew),
            DecimalMath.UNIT
        );
        return proportionalSkew.mulDecimal(maxFundingVelocity);
    }

    function proportionalElapsed(Data storage self) internal view returns (int) {
        return int(block.timestamp.sub(self.lastFundingTime)).divideDecimal(1 days);
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
        int newSkew = int(self.skew).sub(oldSize).add(newSize);
        int newMarketSize = int(self.size).sub(MathUtil.signedAbs(oldSize)).add(
            MathUtil.signedAbs(newSize)
        );

        int newSideSize;
        if (0 < newSize) {
            // long case: marketSize + skew
            //            = (|longSize| + |shortSize|) + (longSize + shortSize)
            //            = 2 * longSize
            newSideSize = newMarketSize.add(newSkew);
        } else {
            // short case: marketSize - skew
            //            = (|longSize| + |shortSize|) - (longSize + shortSize)
            //            = 2 * -shortSize
            newSideSize = newMarketSize.sub(newSkew);
        }

        // newSideSize still includes an extra factor of 2 here, so we will divide by 2 in the actual condition
        if (maxSize < MathUtil.abs(newSideSize.div(2))) {
            return true;
        }

        return false;
    }
}
