//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256, SafeCastI256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {Position} from "./Position.sol";
import {AsyncOrder} from "./AsyncOrder.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {MarketUpdate} from "./MarketUpdate.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {Liquidation} from "./Liquidation.sol";
import {KeeperCosts} from "./KeeperCosts.sol";

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

    /**
     * @notice Thrown when attempting to create a market that already exists or invalid id was passed in
     */
    error InvalidMarket(uint128 marketId);

    /**
     * @notice Thrown when attempting to load a market without a configured price feed
     */
    error PriceFeedNotSet(uint128 marketId);

    /**
     * @notice Thrown when attempting to load a market without a configured keeper costs
     */
    error KeeperCostsNotSet();

    struct Data {
        string name;
        string symbol;
        uint128 id;
        int256 skew;
        uint256 size;
        int256 lastFundingRate;
        int256 lastFundingValue;
        uint256 lastFundingTime;
        // solhint-disable-next-line var-name-mixedcase
        uint128 __unused_1;
        // solhint-disable-next-line var-name-mixedcase
        uint128 __unused_2;
        // debt calculation
        // accumulates total notional size of the market including accrued funding until the last time any position changed
        int256 debtCorrectionAccumulator;
        // accountId => asyncOrder
        mapping(uint => AsyncOrder.Data) asyncOrders;
        // accountId => position
        mapping(uint => Position.Data) positions;
        // liquidation amounts
        Liquidation.Data[] liquidationData;
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

        if (KeeperCosts.load().feedId == "") {
            revert KeeperCostsNotSet();
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
        uint128 requestedLiquidationAmount
    ) internal returns (uint128 liquidatableAmount) {
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(self.id);

        // if endorsedLiquidator is configured and is the sender, allow full liquidation
        if (ERC2771Context._msgSender() == marketConfig.endorsedLiquidator) {
            _updateLiquidationData(self, requestedLiquidationAmount);
            return requestedLiquidationAmount;
        }

        (
            uint liquidationCapacity,
            uint maxLiquidationInWindow,
            uint latestLiquidationTimestamp
        ) = currentLiquidationCapacity(self, marketConfig);

        // this would only occur if there was a misconfiguration (like skew scale not being set)
        // or the max liquidation window not being set etc.
        // in this case, return the entire requested liquidation amount
        if (maxLiquidationInWindow == 0) {
            return requestedLiquidationAmount;
        }

        uint maxLiquidationPd = marketConfig.maxLiquidationPd;
        // if liquidation capacity exists, update accordingly
        if (liquidationCapacity != 0) {
            liquidatableAmount = MathUtil.min128(
                liquidationCapacity.to128(),
                requestedLiquidationAmount
            );
        } else if (
            maxLiquidationPd != 0 &&
            // only allow this if the last update was not in the current block
            latestLiquidationTimestamp != block.timestamp
        ) {
            /**
                if capacity is at 0, but the market is under configured liquidation p/d,
                another block of liquidation becomes allowable.
             */
            uint256 currentPd = MathUtil.abs(self.skew).divDecimal(marketConfig.skewScale);
            if (currentPd < maxLiquidationPd) {
                liquidatableAmount = MathUtil.min128(
                    maxLiquidationInWindow.to128(),
                    requestedLiquidationAmount
                );
            }
        }

        if (liquidatableAmount > 0) {
            _updateLiquidationData(self, liquidatableAmount);
        }
    }

    function _updateLiquidationData(Data storage self, uint128 liquidationAmount) private {
        uint liquidationDataLength = self.liquidationData.length;
        uint currentTimestamp = liquidationDataLength == 0
            ? 0
            : self.liquidationData[liquidationDataLength - 1].timestamp;

        if (currentTimestamp == block.timestamp) {
            self.liquidationData[liquidationDataLength - 1].amount += liquidationAmount;
        } else {
            self.liquidationData.push(
                Liquidation.Data({amount: liquidationAmount, timestamp: block.timestamp})
            );
        }
    }

    /**
     * @dev Returns the current liquidation capacity for the market
     * @notice This function sums up the liquidation amounts in the current liquidation window
     * and returns the capacity left.
     */
    function currentLiquidationCapacity(
        Data storage self,
        PerpsMarketConfiguration.Data storage marketConfig
    )
        internal
        view
        returns (uint capacity, uint256 maxLiquidationInWindow, uint256 latestLiquidationTimestamp)
    {
        maxLiquidationInWindow = marketConfig.maxLiquidationAmountInWindow();
        uint accumulatedLiquidationAmounts;
        uint liquidationDataLength = self.liquidationData.length;
        if (liquidationDataLength == 0) return (maxLiquidationInWindow, maxLiquidationInWindow, 0);

        uint currentIndex = liquidationDataLength - 1;
        latestLiquidationTimestamp = self.liquidationData[currentIndex].timestamp;
        uint windowStartTimestamp = block.timestamp - marketConfig.maxSecondsInLiquidationWindow;

        while (self.liquidationData[currentIndex].timestamp > windowStartTimestamp) {
            accumulatedLiquidationAmounts += self.liquidationData[currentIndex].amount;

            if (currentIndex == 0) break;
            currentIndex--;
        }
        int availableLiquidationCapacity = maxLiquidationInWindow.toInt() -
            accumulatedLiquidationAmounts.toInt();
        // solhint-disable-next-line numcast/safe-cast
        capacity = MathUtil.max(availableLiquidationCapacity, int(0)).toUint();
    }

    /**
     * @dev Use this function to update both market/position size/skew.
     * @dev Size and skew should not be updated directly.
     * @dev The return value is used to emit a MarketUpdated event.
     */
    function updatePositionData(
        Data storage self,
        uint128 accountId,
        Position.Data memory newPosition
    ) internal returns (MarketUpdate.Data memory) {
        Position.Data storage oldPosition = self.positions[accountId];

        int128 oldPositionSize = oldPosition.size;
        int128 newPositionSize = newPosition.size;

        self.size =
            (self.size + MathUtil.abs128(newPositionSize)) -
            MathUtil.abs128(oldPositionSize);
        self.skew += newPositionSize - oldPositionSize;

        uint currentPrice = newPosition.latestInteractionPrice;
        (int totalPositionPnl, , , , ) = oldPosition.getPnl(currentPrice);

        int sizeDelta = newPositionSize - oldPositionSize;
        int fundingDelta = calculateNextFunding(self, currentPrice).mulDecimal(sizeDelta);
        int notionalDelta = currentPrice.toInt().mulDecimal(sizeDelta);

        // update the market debt correction accumulator before losing oldPosition details
        // by adding the new updated notional (old - new size) plus old position pnl
        self.debtCorrectionAccumulator += fundingDelta + notionalDelta + totalPositionPnl;

        oldPosition.update(newPosition);

        return
            MarketUpdate.Data(
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
        return (block.timestamp - self.lastFundingTime).divDecimal(1 days).toInt();
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
        // and the debt correction accumulator is the  sum of all positions pnl
        int traderUnrealizedPnl = self.skew.mulDecimal(price.toInt());
        int unrealizedFunding = self.skew.mulDecimal(calculateNextFunding(self, price));

        return traderUnrealizedPnl + unrealizedFunding - self.debtCorrectionAccumulator;
    }

    function accountPosition(
        uint128 marketId,
        uint128 accountId
    ) internal view returns (Position.Data storage position) {
        position = load(marketId).positions[accountId];
    }
}
