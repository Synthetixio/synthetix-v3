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

        // update market debt correction before losing oldPosition details
        uint currentPrice = newPosition.latestInteractionPrice;
        (int oldPositionPnl, , , ) = oldPosition.getPnl(currentPrice);

        self.debtCorrectionAccumulator +=
            currentPrice.toInt() *
            (newPosition.size - oldPosition.size) -
            oldPositionPnl;

        // self.debtCorrectionAccumulator += newPosition.size * currentPrice.toInt();
        // self.debtCorrectionAccumulator -= oldPosition.size * currentPrice.toInt() - oldPositionPnl ;
        // self.debtCorrectionAccumulator += calculatePositionDebt(newPosition.size, 0, currentPrice);
        // self.debtCorrectionAccumulator -= calculatePositionDebt(
        //     oldPosition.size,
        //     oldPositionPnl,
        //     currentPrice
        // );

        int128 oldPositionSize = oldPosition.size;
        int128 newPositionSize = newPosition.size;

        self.size = (self.size + MathUtil.abs(newPositionSize)) - MathUtil.abs(oldPositionSize);
        self.skew += newPositionSize - oldPositionSize;

        oldPosition.update(newPosition);

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

    function marketDebt(Data storage self, uint price) internal view returns (int) {
        // skew * price - debtCorrectionAccumulator
        // debtCorrectionAccumulator is the accumulated debt correction due to pnl from previous positions
        // debtCorrectionAccumulator = sum(positions[i].size * price + positions[i].pnl )
        // on each interaction that updates a position (size) we update the debtCorrectionAccumulator as
        // debtCorrectionAccumulator += (deltaSize * price ) + positionPnlBefureUpdate

        return self.skew.mulDecimal(price.toInt()) - self.debtCorrectionAccumulator;
    }

    // called at every position update, after funding is recomputed
    // function marketDebtCorrection(
    //     Position.Data storage oldPosition,
    //     Position.Data storage newPosition,
    //     uint currentPrice
    // ) internal view returns (int) {
    //     /*
    //     (newSize - oldSize) * newPrice + pnl
    //     pnl = oldSize * (newPrice - oldPrice) + oldSize * (newFunding - oldFunding)

    //     (newSize - oldSize) * newPrice + oldSize * (newPrice - oldPrice) + oldSize * (newFunding - oldFunding)
    //     (newSize - oldSize) * newPrice + oldSize * (newPrice - oldPrice + newFunding - oldFunding)
    //     newSize * newPrice - oldSize * newPrice + oldSize * newPrice - oldSize * oldPrice + oldSize * newFunding - oldSize * oldFunding

    //     ; currentPrice = newPrice
    //     ; currentFunding = newFunding
    //     newSize * currentPrice - newSize * (currentPrice - newPrice) - newSize * (currentFunding - newFunding)
    //     -
    //     oldSize * currentPrice - oldSize * (currentPrice - oldPrice) - oldSize * (currentFunding - oldFunding)

    //     oldP { size: oldSize, price: oldPrice, funding: oldFunding }
    //     newP { size: newSize, price: newPrice, funding: newFunding }

    //     newP.size * currentPrice - newP.size * (currentPrice - newP.price) - newP.size * (currentFunding - newP.funding)
    //     oldP.size * currentPrice - oldP.size * (currentPrice - newP.price) - newP.size * (currentFunding - newP.funding)

    //     calculateFix (position, currentPrice, currentFunding)
    //         position.size * currentPrice - position.size * (currentPrice - position.price) - position.size * (currentFunding - position.funding

    //     return calculateFix(newPosition, currentPrice, currentFunding) - calculateFix(oldPosition, currentPrice, currentFunding);
    //     */
    //     (int newPositionPnl, , , ) = newPosition.getPnl(currentPrice);
    //     (int oldPositionPnl, , , ) = oldPosition.getPnl(currentPrice);
    //     return
    //         calculatePositionDebt(newPosition.size, newPositionPnl, currentPrice) -
    //         calculatePositionDebt(oldPosition.size, oldPositionPnl, currentPrice);
    // }

    // function calculatePositionDebt(
    //     int positionSize,
    //     int positionPnl,
    //     uint currentPrice
    // ) internal pure returns (int) {
    //     if (positionSize == 0) {
    //         return 0;
    //     }
    //     return positionSize * currentPrice.toInt() - positionPnl;
    //     // calculatePositionPnL(position, currentPrice, currentFunding);
    // }

    // function calculatePositionPnL(
    //     Position.Data storage position,
    //     uint currentPrice,
    //     int currentFunding
    // ) internal view returns (int) {
    //     // pnl = pricePnl + funding Pnl = size * (currentPrice - price) + size * (currentFunding - funding)
    //     return
    //         position.size *
    //         (currentPrice.toInt() - position.latestInteractionPrice.toInt()) +
    //         position.size *
    //         (currentFunding - position.latestInteractionFunding);
    // }
}
