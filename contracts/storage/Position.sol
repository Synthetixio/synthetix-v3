//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128, SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {Order} from "./Order.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {PerpMarketConfiguration} from "./PerpMarketConfiguration.sol";
import {Margin} from "./Margin.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

/**
 * @dev An open position on a specific perp market within bfp-market.
 */
library Position {
    using DecimalMath for uint256;
    using DecimalMath for int256;
    using DecimalMath for int128;
    using DecimalMath for uint128;
    using SafeCastU128 for uint128;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpMarket for PerpMarket.Data;

    // --- Structs --- //

    struct TradeParams {
        int128 sizeDelta;
        uint256 oraclePrice;
        uint256 fillPrice;
        uint128 makerFee;
        uint128 takerFee;
        uint256 limitPrice;
        uint256 keeperFeeBufferUsd;
    }

    struct ValidatedTrade {
        Position.Data newPosition;
        uint256 orderFee;
        uint256 keeperFee;
        uint256 newMarginUsd;
    }

    // --- Runtime Structs --- //

    struct Runtime_validateLiquidation {
        address flagger;
        uint128 oldPositionSizeAbs;
        uint128 maxLiquidatableCapacity;
        uint128 remainingCapacity;
        uint128 lastLiquidationTime;
    }

    // --- Storage --- //

    struct Data {
        // Size (in native units e.g. wstETH)
        int128 size;
        // The market's accumulated accrued funding at position open.
        int256 entryFundingAccrued;
        // The fill price at which this position was opened with.
        uint256 entryPrice;
        // Accured static fees incurred to manage this position (e.g. keeper + order + liqRewards + xyz).
        uint256 accruedFeesUsd;
    }

    /**
     * @dev Validates whether a change in a position's size would violate the max market value constraint.
     *
     * A perp market has one configurable variable `maxMarketSize` which constraints the maximum open interest
     * a market can have on either side.
     */
    function validateMaxOi(
        uint256 maxMarketSize,
        int256 marketSkew,
        uint256 marketSize,
        int256 currentSize,
        int256 newSize
    ) internal pure {
        // Allow users to reduce an order no matter the market conditions.
        if (MathUtil.sameSide(currentSize, newSize) && MathUtil.abs(newSize) <= MathUtil.abs(currentSize)) {
            return;
        }

        // Either the user is flipping sides, or they are increasing an order on the same side they're already on;
        // we check that the side of the market their order is on would not break the limit.
        int256 newSkew = marketSkew - currentSize + newSize;
        int256 newMarketSize = (marketSize - MathUtil.abs(currentSize) + MathUtil.abs(newSize)).toInt();

        int256 newSideSize;
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

        // newSideSize still includes an extra factor of 2 here, so we will divide by 2 in the actual condition.
        if (maxMarketSize < MathUtil.abs(newSideSize / 2)) {
            revert ErrorUtil.MaxMarketSizeExceeded();
        }
    }

    /**
     * @dev Validates whether the `newPosition` can be liquidated using their health factor.
     */
    function validateNextPositionIsLiquidatable(
        PerpMarket.Data storage market,
        Position.Data memory newPosition,
        uint256 marginUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view {
        (uint256 healthFactor, , , ) = getHealthData(
            market,
            newPosition.size,
            newPosition.entryPrice,
            newPosition.entryFundingAccrued,
            marginUsd,
            price,
            marketConfig
        );

        if (healthFactor <= DecimalMath.UNIT) {
            revert ErrorUtil.CanLiquidatePosition();
        }
    }

    /**
     * @dev Validates whether the given `TradeParams` would lead to a valid next position.
     */
    function validateTrade(
        uint128 accountId,
        PerpMarket.Data storage market,
        Position.TradeParams memory params
    ) internal view returns (Position.ValidatedTrade memory) {
        // Empty order is a no.
        if (params.sizeDelta == 0) {
            revert ErrorUtil.NilOrder();
        }

        Position.Data storage currentPosition = market.positions[accountId];
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(market.id);
        uint256 marginUsd = Margin.getMarginUsd(accountId, market, params.fillPrice);

        // --- Existing position validation --- //

        // There's an existing position. Make sure we have a valid existing position before allowing modification.
        if (currentPosition.size != 0) {
            // Position is frozen due to prior flagged for liquidation.
            if (market.flaggedLiquidations[accountId] != address(0)) {
                revert ErrorUtil.PositionFlagged();
            }

            // Determine if the currentPosition can immediately be liquidated.
            if (isLiquidatable(currentPosition, market, marginUsd, params.fillPrice, marketConfig)) {
                revert ErrorUtil.CanLiquidatePosition();
            }

            // Determine if the current position has enough margin to perform further changes.
            //
            // NOTE: The use of fillPrice and not oraclePrice to perform calculations below. Also consider this is the
            // "raw" remaining margin which does not account for fees (liquidation fees, penalties, liq premium fees etc.).
            (uint256 imcp, , ) = getLiquidationMarginUsd(currentPosition.size, params.fillPrice, marketConfig);
            if (marginUsd < imcp) {
                revert ErrorUtil.InsufficientMargin();
            }
        }

        // --- New position validation (as though the order settled) --- //

        // Derive fees incurred and next position if this order were to be settled successfully.
        uint256 orderFee = Order.getOrderFee(
            params.sizeDelta,
            params.fillPrice,
            market.skew,
            params.makerFee,
            params.takerFee
        );
        uint256 keeperFee = Order.getSettlementKeeperFee(params.keeperFeeBufferUsd);
        Position.Data memory newPosition = Position.Data(
            currentPosition.size + params.sizeDelta,
            market.currentFundingAccruedComputed,
            params.fillPrice,
            orderFee + keeperFee
        );

        // Minimum position margin checks, however if a position is decreasing (i.e. derisking by lowering size), we
        // avoid this completely due to positions at min margin would never be allowed to lower size.
        bool positionDecreasing = MathUtil.sameSide(currentPosition.size, newPosition.size) &&
            MathUtil.abs(newPosition.size) < MathUtil.abs(currentPosition.size);
        (uint256 imnp, , ) = getLiquidationMarginUsd(newPosition.size, params.fillPrice, marketConfig);

        // `marginUsd` is the previous position margin (which includes accruedFeesUsd deducted with open
        // position). We `-fee and -keeperFee` here because the new position would have incurred additional fees if
        // this trader were to be settled successfully.
        //
        // This is important as it helps avoid instant liquidation on successful settlement.
        uint256 newMarginUsd = MathUtil.max(marginUsd.toInt() - orderFee.toInt() - keeperFee.toInt(), 0).toUint();

        if (!positionDecreasing && newMarginUsd < imnp) {
            revert ErrorUtil.InsufficientMargin();
        }

        // Check new position can't just be instantly liquidated.
        validateNextPositionIsLiquidatable(market, newPosition, newMarginUsd, params.fillPrice, marketConfig);

        // Check the new position hasn't hit max OI on either side.
        validateMaxOi(marketConfig.maxMarketSize, market.skew, market.size, currentPosition.size, newPosition.size);

        return Position.ValidatedTrade(newPosition, orderFee, keeperFee, newMarginUsd);
    }

    /**
     * @dev Validates whether the position at `accountId` and `marketId` would pass liquidation.
     */
    function validateLiquidation(
        uint128 accountId,
        PerpMarket.Data storage market,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig,
        uint256 price
    )
        internal
        view
        returns (
            Position.Data storage oldPosition,
            Position.Data memory newPosition,
            uint128 liqSize,
            uint256 liqReward,
            uint256 keeperFee
        )
    {
        Position.Runtime_validateLiquidation memory runtime;

        // The position must be flagged first.
        runtime.flagger = market.flaggedLiquidations[accountId];
        if (runtime.flagger == address(0)) {
            revert ErrorUtil.PositionNotFlagged();
        }

        // Precautionary to ensure we're liquidating an open position.
        oldPosition = market.positions[accountId];
        runtime.oldPositionSizeAbs = MathUtil.abs(oldPosition.size).to128();
        if (runtime.oldPositionSizeAbs == 0) {
            revert ErrorUtil.PositionNotFound();
        }

        // Fetch the available capacity then alter iff zero AND the caller is a whitelisted endorsed liquidation keeper.
        (runtime.maxLiquidatableCapacity, runtime.remainingCapacity, runtime.lastLiquidationTime) = market
            .getRemainingLiquidatableSizeCapacity(marketConfig);

        if (msg.sender == globalConfig.keeperLiquidationEndorsed && runtime.remainingCapacity == 0) {
            runtime.remainingCapacity = runtime.oldPositionSizeAbs;
        }

        // At max capacity for current liquidation window.
        if (runtime.remainingCapacity == 0) {
            uint128 skewScale = marketConfig.skewScale;
            uint128 liquidationMaxPd = marketConfig.liquidationMaxPd;

            // Allow max capacity to be bypassed iff the following holds true:
            //  1. remainingCapacity is zero (as parent)
            //  2. This liquidation is _not_ in the same block as the most recent liquidation
            //  3. The current market premium/discount does not exceed a configurable maxPd.
            //  4. The current position size as skew does not exceed a configurable maxPd.
            if (
                runtime.lastLiquidationTime != block.timestamp &&
                MathUtil.abs(market.skew).divDecimal(skewScale) < liquidationMaxPd &&
                runtime.oldPositionSizeAbs.divDecimal(skewScale) < liquidationMaxPd
            ) {
                runtime.remainingCapacity = runtime.oldPositionSizeAbs > runtime.maxLiquidatableCapacity
                    ? runtime.maxLiquidatableCapacity
                    : runtime.oldPositionSizeAbs;
            } else {
                // No liquidation for you.
                revert ErrorUtil.LiquidationZeroCapacity();
            }
        }

        // Determine the resulting position post liqudation.
        liqSize = MathUtil.min(runtime.remainingCapacity, runtime.oldPositionSizeAbs).to128();
        liqReward = getLiquidationReward(liqSize, price, marketConfig);
        keeperFee = getLiquidationKeeperFee();
        newPosition = Position.Data(
            oldPosition.size > 0 ? oldPosition.size - liqSize.toInt() : oldPosition.size + liqSize.toInt(),
            oldPosition.entryFundingAccrued,
            oldPosition.entryPrice,
            // An accumulation of fees paid on liquidation and reward paid out to the liquidator.
            oldPosition.accruedFeesUsd + liqReward + keeperFee
        );
    }

    /**
     * @dev Returns the liqReward (without IM/MM). Useful if you just want liqReward without the heavy gas costs of
     * retrieving the MM (as it includes the liqKeeperFee which involves fetching current ETH/USD price). Note that size
     * is a uint so shorts must be .abs before passed through.
     */
    function getLiquidationReward(
        uint128 size,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256) {
        return size.mulDecimal(price).mulDecimal(marketConfig.liquidationRewardPercent);
    }

    /**
     * @dev Returns the IM and MM given relevant market details for a specified position size.
     *
     * Intuitively, IM (initial margin) can be thought of as the minimum amount of margin a trader must deposit
     * before they can open a trade. MM (maintenance margin) refers the amount of margin a trader must have
     * to _maintain_ their position. If the value of the collateral that make up said margin falls below this value
     * then the position is up for liquidation.
     *
     * To mitigate risk, we scale these two values up and down based on the position size and impact to market
     * skew. Large positions, hence more impactful to skew, require a larger IM/MM. Remember that the larger the
     * impact to skew, the more risk stakers take on.
     */
    function getLiquidationMarginUsd(
        int128 positionSize,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256 im, uint256 mm, uint256 liqReward) {
        uint128 absSize = MathUtil.abs(positionSize).to128();
        uint256 notional = absSize.mulDecimal(price);

        uint256 imr = absSize.divDecimal(marketConfig.skewScale).mulDecimal(marketConfig.incrementalMarginScalar) +
            marketConfig.minMarginRatio;
        uint256 mmr = imr.mulDecimal(marketConfig.maintenanceMarginScalar);

        liqReward = getLiquidationReward(absSize, price, marketConfig);
        im = notional.mulDecimal(imr) + marketConfig.minMarginUsd;
        mm = notional.mulDecimal(mmr) + marketConfig.minMarginUsd + liqReward + getLiquidationKeeperFee();
    }

    /**
     * @dev Returns the fee in USD paid to keeper for performing the liquidation (not flagging).
     */
    function getLiquidationKeeperFee() internal view returns (uint256) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        uint256 ethPrice = globalConfig.oracleManager.process(globalConfig.ethOracleNodeId).price.toUint();
        uint256 baseKeeperFeeUsd = globalConfig.keeperLiquidationGasUnits * block.basefee * ethPrice;
        uint256 boundedKeeperFeeUsd = MathUtil.max(
            MathUtil.min(
                globalConfig.minKeeperFeeUsd,
                baseKeeperFeeUsd * (DecimalMath.UNIT + globalConfig.keeperProfitMarginPercent)
            ),
            globalConfig.maxKeeperFeeUsd
        );
        return boundedKeeperFeeUsd;
    }

    /**
     * @dev Returns the health data given the marketId, config, and position{...} details.
     */
    function getHealthData(
        PerpMarket.Data storage market,
        int128 positionSize,
        uint256 positionEntryPrice,
        int256 positionEntryFundingAccrued,
        uint256 marginUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256 healthFactor, int256 accruedFunding, int256 pnl, uint256 remainingMarginUsd) {
        (, int256 unrecordedFunding) = market.getUnrecordedFundingWithRate(price);
        int256 netFundingPerUnit = unrecordedFunding - positionEntryFundingAccrued;
        accruedFunding = positionSize.mulDecimal(netFundingPerUnit);

        // Calculate this position's PnL
        pnl = positionSize.mulDecimal(price.toInt() - positionEntryPrice.toInt());

        // Ensure we also deduct the realized losses in fees to open trade.
        //
        // The remaining margin is defined as sum(collateral * price) + PnL + funding in USD.
        // We expect caller to have gotten this from Margin.getMarginUsd
        remainingMarginUsd = marginUsd;

        // margin / mm <= 1 means liquidation.
        (, uint256 mm, ) = getLiquidationMarginUsd(positionSize, price, marketConfig);
        healthFactor = remainingMarginUsd.divDecimal(mm);
    }

    // --- Member (views) --- //

    /**
     * @dev An overloaded function over `getHealthData` using the a Position storage struct.
     */
    function getHealthData(
        Position.Data storage self,
        PerpMarket.Data storage market,
        uint256 marginUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256 healthFactor, int256 accruedFunding, int256 pnl, uint256 remainingMarginUsd) {
        return
            getHealthData(market, self.size, self.entryPrice, self.entryFundingAccrued, marginUsd, price, marketConfig);
    }

    /**
     * @dev Returns the health factor associated with this position.
     */
    function getHealthFactor(
        Position.Data storage self,
        PerpMarket.Data storage market,
        uint256 marginUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256) {
        (uint256 healthFactor, , , ) = getHealthData(
            market,
            self.size,
            self.entryPrice,
            self.entryFundingAccrued,
            marginUsd,
            price,
            marketConfig
        );
        return healthFactor;
    }

    /**
     * @dev Returns whether the current position can be liquidated.
     */
    function isLiquidatable(
        Position.Data storage self,
        PerpMarket.Data storage market,
        uint256 marginUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (bool) {
        if (self.size == 0) {
            return false;
        }

        (uint256 healthFactor, , , ) = getHealthData(self, market, marginUsd, price, marketConfig);

        return healthFactor <= DecimalMath.UNIT;
    }

    /**
     * @dev Returns the absolute profit or loss based on current price and entry price.
     */
    function getPnl(Position.Data storage self, uint256 price) internal view returns (int256) {
        if (self.size == 0) {
            return 0;
        }
        return self.size.mulDecimal(price.toInt() - self.entryPrice.toInt());
    }

    /**
     * @dev Returns the funding accrued from when the position was opened to now.
     */
    function getAccruedFunding(
        Position.Data storage self,
        PerpMarket.Data storage market,
        uint256 price
    ) internal view returns (int256) {
        if (self.size == 0) {
            return 0;
        }

        (, int256 unrecordedFunding) = market.getUnrecordedFundingWithRate(price);
        return self.size.mulDecimal(unrecordedFunding - self.entryFundingAccrued);
    }

    // --- Member (mutative) --- //

    /**
     * @dev Clears the current position struct in-place of any stored data.
     */
    function update(Position.Data storage self, Position.Data memory data) internal {
        self.size = data.size;
        self.entryFundingAccrued = data.entryFundingAccrued;
        self.entryPrice = data.entryPrice;
        self.accruedFeesUsd = data.accruedFeesUsd;
    }
}
