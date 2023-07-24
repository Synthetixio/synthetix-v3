//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256, SafeCastI256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {PerpsAccount} from "./PerpsAccount.sol";
import {Position} from "./Position.sol";
import {AsyncOrder} from "./AsyncOrder.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {OrderFee} from "./OrderFee.sol";
import {PerpsPrice} from "./PerpsPrice.sol";

/**
 * @title Data for a single perps market
 */
library PerpsMarket {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using Position for Position.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;

    error InvalidMarket(uint128 marketId);

    error PriceFeedNotSet(uint128 marketId);

    error MarketAlreadyExists(uint128 marketId);

    struct Data {
        string name;
        string symbol;
        uint128 id;
        int256 skew;
        uint256 size;
        // TODO: move to new data structure?
        int256 lastFundingRate;
        int256 lastFundingValue;
        uint256 lastFundingTime;
        // liquidation data
        uint128 lastTimeLiquidationCapacityUpdated;
        uint128 lastUtilizedLiquidationCapacity;
        // debt calculation
        int256 debtCorrectionAccumulator;
        // accountId => asyncOrder
        mapping(uint => AsyncOrder.Data) asyncOrders;
        // accountId => position
        mapping(uint => Position.Data) positions;
    }

    function load(uint128 marketId) internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.PerpsMarket", marketId));

        assembly {
            market.slot := s
        }
    }

    function createValid(
        uint128 id,
        string memory name,
        string memory symbol
    ) internal returns (Data storage market) {
        if (id == 0 || load(id).id == id) {
            revert InvalidMarket(id);
        }

        market = load(id);

        market.id = id;
        market.name = name;
        market.symbol = symbol;
    }

    /**
     * @dev Reverts if the market does not exist with appropriate error. Otherwise, returns the market.
     */
    function loadValid(uint128 marketId) internal view returns (Data storage market) {
        market = load(marketId);
        if (market.id == 0) {
            revert InvalidMarket(marketId);
        }

        if (PerpsPrice.load(marketId).feedId == "") {
            revert PriceFeedNotSet(marketId);
        }
    }

    /**
     * @dev Returns the max amount of liquidation that can occur based on the market configuration
     * @notice Based on the configured liquidation window, a trader can only be liquidated for a certain
     *   amount within that window.  If the amount requested is greater than the amount allowed, the
     *   smaller amount is returned.  The function also updates its accounting to ensure the results on
     *   subsequent liquidations work appropriately.
     */
    function maxLiquidatableAmount(
        Data storage self,
        uint256 requestedLiquidationAmount
    ) internal returns (uint128 liquidatableAmount) {
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(self.id);

        uint maxLiquidationAmountPerSecond = marketConfig.maxLiquidationAmountPerSecond();
        // this would only be 0 if fees or skew scale are configured to be 0.
        // in that case, (very unlikely), allow full liquidation
        if (maxLiquidationAmountPerSecond == 0) {
            return requestedLiquidationAmount.to128();
        }

        uint timeSinceLastUpdate = block.timestamp - self.lastTimeLiquidationCapacityUpdated;
        uint maxSecondsInLiquidationWindow = marketConfig.maxSecondsInLiquidationWindow;

        uint256 maxAllowedLiquidationInWindow = maxSecondsInLiquidationWindow *
            maxLiquidationAmountPerSecond;
        if (timeSinceLastUpdate > maxSecondsInLiquidationWindow) {
            liquidatableAmount = MathUtil
                .min(maxAllowedLiquidationInWindow, requestedLiquidationAmount)
                .to128();
            self.lastUtilizedLiquidationCapacity = liquidatableAmount;
        } else {
            liquidatableAmount = MathUtil
                .min(
                    maxAllowedLiquidationInWindow - self.lastUtilizedLiquidationCapacity,
                    requestedLiquidationAmount
                )
                .to128();
            self.lastUtilizedLiquidationCapacity += liquidatableAmount;
        }

        // only update timestamp if there is something being liquidated
        if (liquidatableAmount > 0) {
            self.lastTimeLiquidationCapacityUpdated = block.timestamp.to128();
        }
    }

    struct MarketUpdateData {
        uint128 marketId;
        int256 skew;
        uint256 size;
        int256 currentFundingRate;
        int256 currentFundingVelocity;
    }

    /**
     * @dev If you call this method, please ensure you emit an event so offchain solution can index market state history properly
     */
    function updatePositionData(
        Data storage self,
        uint128 accountId,
        Position.Data memory newPosition
    ) internal returns (MarketUpdateData memory) {
        Position.Data storage oldPosition = self.positions[accountId];

        int128 oldPositionSize = oldPosition.size;

        // update the market debt correction accumulator before losing oldPosition details
        // by adding the new updated notional (old - new size) plus old position pnl
        // debtCorrectionAccumulator += newPosition.size * currentPrice.toInt() - oldPosition.size * currentPrice.toInt() + oldPositionPnl ;
        uint currentPrice = newPosition.latestInteractionPrice;
        (int oldPositionPnl, , , ) = oldPosition.getPnl(currentPrice);

        self.debtCorrectionAccumulator +=
            currentPrice.toInt().mulDecimal(newPosition.size - oldPositionSize) +
            oldPositionPnl;

        updateMarketSizes(self, newPosition.size, oldPositionSize);
        oldPosition.updatePosition(newPosition);
        // TODO add current market debt
        return
            MarketUpdateData(
                self.id,
                self.skew,
                self.size,
                self.lastFundingRate,
                currentFundingVelocity(self)
            );
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
            self.lastFundingRate +
            (currentFundingVelocity(self).mulDecimal(proportionalElapsed(self)));
    }

    function currentFundingVelocity(Data storage self) internal view returns (int) {
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(self.id);
        int maxFundingVelocity = marketConfig.maxFundingVelocity.toInt();
        int skewScale = marketConfig.skewScale.toInt();
        // Avoid a panic due to div by zero. Return 0 immediately.
        if (skewScale == 0) {
            return 0;
        }
        // Ensures the proportionalSkew is between -1 and 1.
        int pSkew = self.skew.divDecimal(skewScale);
        int pSkewBounded = MathUtil.min(
            MathUtil.max(-(DecimalMath.UNIT).toInt(), pSkew),
            (DecimalMath.UNIT).toInt()
        );
        return pSkewBounded.mulDecimal(maxFundingVelocity);
    }

    function proportionalElapsed(Data storage self) internal view returns (int) {
        return (block.timestamp - self.lastFundingTime).toInt().divDecimal(1 days);
    }

    function validatePositionSize(
        Data storage self,
        uint maxSize,
        int oldSize,
        int newSize
    ) internal view {
        // Allow users to reduce an order no matter the market conditions.
        bool isNotReducingInterest = !(MathUtil.sameSide(oldSize, newSize) &&
            MathUtil.abs(newSize) <= MathUtil.abs(oldSize));
        if (isNotReducingInterest) {
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
                revert PerpsMarketConfiguration.MaxOpenInterestReached(
                    self.id,
                    maxSize,
                    newSideSize / 2
                );
            }
        }
    }

    /**
     * @dev Returns the market debt incurred by all positions
     * @notice  Market debt is the sum of all position sizes multiplied by the price, and old positions pnl that is included in the debt correction accumulator.
     */
    function marketDebt(Data storage self, uint price) internal view returns (int) {
        // all positions sizes multiplied by the price is equivalent to skew times price
        // and the debt correction accumulator is the sum of all positions pnl

        return self.skew.mulDecimal(price.toInt()) - self.debtCorrectionAccumulator;
    }
}
