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

    struct HealthData {
        uint256 healthFactor;
        int256 accruedFunding;
        uint256 accruedUtilization;
        int256 pnl;
        uint256 remainingMarginUsd;
    }

    // --- Runtime structs --- //

    struct Runtime_validateLiquidation {
        address flagger;
        uint128 oldPositionSizeAbs;
        uint128 maxLiquidatableCapacity;
        uint128 remainingCapacity;
        uint128 lastLiquidationTime;
    }

    // --- Storage --- //

    struct Data {
        // Size (in native units e.g. swstETH)
        int128 size;
        // The market's accumulated accrued funding at position settlement.
        int256 entryFundingAccrued;
        // The market's accumulated accrued utilisation at position settlement.
        uint256 entryUtilizationAccrued;
        // The fill price at which this position was settled with.
        uint256 entryPrice;
        // Accured static fees in USD incurred to manage this position (e.g. keeper + order + liqRewards + xyz).
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
     * @dev Infers the post settlement marginUsd by deducting the order and keeperFee.
     *
     * NOTE: The previous margin (which may include a haircut on the collteral; used for liquidation checks) includes the
     * previous PnL, accrued funding, fees etc. We `-fee` and `-keeperFee` here as they're deducted on the settlement.
     * This is important as it helps avoid instant liquidations immediately after settlement.
     */
    function getNextMarginUsd(uint256 marginUsd, uint256 orderFee, uint256 keeperFee) internal pure returns (uint256) {
        return MathUtil.max(marginUsd.toInt() - orderFee.toInt() - keeperFee.toInt(), 0).toUint();
    }

    /**
     * @dev Validates whether the `newPosition` can be liquidated or below margin req.
     *
     * NOTE: We expect marginUsd here to be the haircut adjusted margin due to liquidation checks as margin checks
     * for liquidations are expected to discount the collateral.
     */
    function validateNextPositionEnoughMargin(
        PerpMarket.Data storage market,
        Position.Data storage currentPosition,
        Position.Data memory newPosition,
        uint128 accountId,
        uint256 orderFee,
        uint256 keeperFee,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view {
        bool positionDecreasing = MathUtil.sameSide(currentPosition.size, newPosition.size) &&
            MathUtil.abs(newPosition.size) < MathUtil.abs(currentPosition.size);
        (uint256 im, , ) = getLiquidationMarginUsd(newPosition.size, newPosition.entryPrice, marketConfig);

        // Calc position margin using the fillPrice (pos.entryPrice) with the haircut adjustment applied. We
        // care about haircut as as we're verifying for liquidation.
        //
        // NOTE: getMarginUsd looks at the current position's overall PnL but it does consider the post settled
        // incurred fees hence get `nextMarginUsd` with fees deducted.
        uint256 marginUsd = Margin.getMarginUsd(
            accountId,
            market,
            newPosition.entryPrice,
            true /* useHaircutCollateralPrice */
        );
        uint256 nextMarginUsd = getNextMarginUsd(marginUsd, orderFee, keeperFee);

        // Minimum position margin checks, however if a position is decreasing (i.e. derisking by lowering size), we
        // avoid this completely due to positions at min margin would never be allowed to lower size.
        if (!positionDecreasing && nextMarginUsd < im) {
            revert ErrorUtil.InsufficientMargin();
        }

        uint256 onchainPrice = market.getOraclePrice();

        // Delta between oracle and fillPrice (pos.entryPrice) may be large if settled on a very skewed market (i.e
        // a high premium paid). This can lead to instant liquidation on the settle so we deduct that difference from
        // the margin before verifying the health factor to account for the premium.
        //
        // NOTE: The `min(delta, 0)` as we only want to _reduce_ their remaining margin, not increase it in the case where
        // a discount is applied for reducing skew.
        int256 fillPremium = MathUtil.min(
            newPosition.size.mulDecimal(onchainPrice.toInt() - newPosition.entryPrice.toInt()),
            0
        );
        uint256 remainingMarginUsd = MathUtil.max(nextMarginUsd.toInt() + fillPremium, 0).toUint();
        (, uint256 mm, ) = getLiquidationMarginUsd(newPosition.size, onchainPrice, marketConfig);
        uint256 healthFactor = remainingMarginUsd.divDecimal(mm);

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

        // --- Existing position validation --- //

        // There's an existing position. Make sure we have a valid existing position before allowing modification.
        if (currentPosition.size != 0) {
            // Position is frozen due to prior flagged for liquidation.
            if (market.flaggedLiquidations[accountId] != address(0)) {
                revert ErrorUtil.PositionFlagged();
            }

            // Detearmine if the current (previous) position can be immediately liquidated.
            if (
                isLiquidatable(
                    currentPosition,
                    market,
                    Margin.getMarginUsd(accountId, market, params.oraclePrice, true /* useHaircutCollateralPrice */),
                    params.oraclePrice,
                    marketConfig
                )
            ) {
                revert ErrorUtil.CanLiquidatePosition();
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
            // Since utilization looks backwards and wont be recomputed here we need to manually add the unrecorded utilization.
            market.currentUtilizationAccruedComputed + market.getUnrecordedUtilization(),
            params.fillPrice,
            orderFee + keeperFee
        );

        // Check new position margin validations.
        validateNextPositionEnoughMargin(
            market,
            currentPosition,
            newPosition,
            accountId,
            orderFee,
            keeperFee,
            marketConfig
        );

        // Check the new position hasn't hit max OI on either side.
        validateMaxOi(marketConfig.maxMarketSize, market.skew, market.size, currentPosition.size, newPosition.size);

        // For everything else, we actually need to use the unadjusted marginUsd as the collateral haircut is only
        // applicable for liquidation related checks.
        uint256 marginUsd = Margin.getMarginUsd(
            accountId,
            market,
            params.fillPrice,
            false /* useHaircutCollateralPrice */
        );
        uint256 nextMarginUsd = getNextMarginUsd(marginUsd, orderFee, keeperFee);
        return Position.ValidatedTrade(newPosition, orderFee, keeperFee, nextMarginUsd);
    }

    /**
     * @dev Validates whether the position at `accountId` and `marketId` would pass liquidation.
     */
    function validateLiquidation(
        uint128 accountId,
        PerpMarket.Data storage market,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig
    )
        internal
        view
        returns (
            Position.Data storage oldPosition,
            Position.Data memory newPosition,
            uint128 liqSize,
            uint256 liqKeeperFee
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
            if (
                runtime.lastLiquidationTime != block.timestamp &&
                MathUtil.abs(market.skew).divDecimal(skewScale) < liquidationMaxPd
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
        liqKeeperFee = getLiquidationKeeperFee(liqSize, marketConfig, globalConfig);
        newPosition = Position.Data(
            oldPosition.size > 0 ? oldPosition.size - liqSize.toInt() : oldPosition.size + liqSize.toInt(),
            oldPosition.entryFundingAccrued,
            oldPosition.entryUtilizationAccrued,
            oldPosition.entryPrice,
            // An accumulation of fees paid on liquidation paid out to the liquidator.
            oldPosition.accruedFeesUsd + liqKeeperFee
        );
    }

    /**
     * @dev Returns the reward for flagging a position given a certian position size, "flagKeeperReward"
     * Note that size here is a uint so we expect to be passed position.size.abs()
     */
    function getLiquidationFlagReward(
        uint128 size,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        uint256 ethPrice = globalConfig.oracleManager.process(globalConfig.ethOracleNodeId).price.toUint();
        uint256 flagExecutionCostInUsd = ethPrice.mulDecimal(block.basefee * globalConfig.keeperFlagGasUnits);

        uint256 flagFeeInUsd = MathUtil.max(
            flagExecutionCostInUsd.mulDecimal(DecimalMath.UNIT + globalConfig.keeperProfitMarginPercent),
            flagExecutionCostInUsd + globalConfig.keeperProfitMarginUsd
        );
        uint256 flagFeeWithRewardInUsd = flagFeeInUsd +
            size.mulDecimal(price).mulDecimal(marketConfig.liquidationRewardPercent);

        return MathUtil.min(flagFeeWithRewardInUsd, globalConfig.maxKeeperFeeUsd);
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
    ) internal view returns (uint256 im, uint256 mm, uint256 liqFlagReward) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        uint128 absSize = MathUtil.abs(positionSize).to128();
        uint256 notional = absSize.mulDecimal(price);

        uint256 imr = absSize.divDecimal(marketConfig.skewScale).mulDecimal(marketConfig.incrementalMarginScalar) +
            marketConfig.minMarginRatio;
        uint256 mmr = imr.mulDecimal(marketConfig.maintenanceMarginScalar);

        liqFlagReward = getLiquidationFlagReward(absSize, price, marketConfig, globalConfig);

        im = notional.mulDecimal(imr) + marketConfig.minMarginUsd;
        mm =
            notional.mulDecimal(mmr) +
            marketConfig.minMarginUsd +
            liqFlagReward +
            getLiquidationKeeperFee(absSize, marketConfig, globalConfig);
    }

    function getMaintenanceMargin(
        int128 positionSize,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256 mm) {
        (, mm, ) = getLiquidationMarginUsd(positionSize, price, marketConfig);
    }

    /**
     * @dev Returns the number of partial liquidations required given liquidation size and mac liquidation capacity.
     */
    function getLiquidationIterations(uint256 liqSize, uint256 maxLiqCapacity) internal pure returns (uint256) {
        if (maxLiqCapacity == 0) {
            return 0;
        }

        // ceil(liqSize / maxLiqCapacity).
        uint256 quotient = liqSize / maxLiqCapacity;
        uint256 remainder = liqSize % maxLiqCapacity;
        return remainder == 0 ? quotient : quotient + 1;
    }

    /**
     * @dev Returns the fee in USD paid to keeper for performing the liquidation (not flagging).
     *
     * The size here is either liqSize or position.size.abs()
     */
    function getLiquidationKeeperFee(
        uint128 size,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        // We exit early it size is 0, this would only happen then remaining liqcapacity is 0.
        if (size == 0) {
            return 0;
        }

        uint256 ethPrice = globalConfig.oracleManager.process(globalConfig.ethOracleNodeId).price.toUint();
        uint256 maxLiqCapacity = PerpMarket.getMaxLiquidatableCapacity(marketConfig);

        uint256 liquidationExecutionCostUsd = ethPrice.mulDecimal(
            block.basefee * globalConfig.keeperLiquidationGasUnits
        );

        uint256 liquidationFeeInUsd = MathUtil.max(
            liquidationExecutionCostUsd.mulDecimal(DecimalMath.UNIT + globalConfig.keeperProfitMarginPercent),
            liquidationExecutionCostUsd + globalConfig.keeperProfitMarginUsd
        );

        uint256 iterations = getLiquidationIterations(size, maxLiqCapacity);
        return MathUtil.min(liquidationFeeInUsd, globalConfig.maxKeeperFeeUsd) * iterations;
    }

    /**
     * @dev Returns the health data given the marketId, config, and position{...} details.
     *
     * NOTE: marginUsd _must_ be calculated with `useHaircutCollateralPrice=true` in order to correctly calculate a position's
     * health related data and factor.
     */
    function getHealthData(
        PerpMarket.Data storage market,
        int128 positionSize,
        uint256 positionEntryPrice,
        int256 positionEntryFundingAccrued,
        uint256 positionEntryUtilizationAccrued,
        uint256 marginUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (Position.HealthData memory) {
        Position.HealthData memory healthData;

        healthData.accruedFunding = positionSize.mulDecimal(
            market.getUnrecordedFunding(price) + market.currentFundingAccruedComputed - positionEntryFundingAccrued
        );
        healthData.accruedUtilization = MathUtil.abs(positionSize).mulDecimal(price).mulDecimal(
            market.getUnrecordedUtilization() +
                market.currentUtilizationAccruedComputed -
                positionEntryUtilizationAccrued
        );

        // Calculate this position's PnL
        healthData.pnl = positionSize.mulDecimal(price.toInt() - positionEntryPrice.toInt());

        // Ensure we also deduct the realized losses in fees to open trade.
        //
        // The remaining margin is defined as sum(collateral * price) + PnL + funding in USD.
        // We expect caller to have gotten this from Margin.getMarginUsd
        healthData.remainingMarginUsd = marginUsd;

        // margin / mm <= 1 means liquidation.
        healthData.healthFactor = healthData.remainingMarginUsd.divDecimal(
            getMaintenanceMargin(positionSize, price, marketConfig)
        );
        return healthData;
    }

    // --- Member (views) --- //

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
        Position.HealthData memory healthData = Position.getHealthData(
            market,
            self.size,
            self.entryPrice,
            self.entryFundingAccrued,
            self.entryUtilizationAccrued,
            marginUsd,
            price,
            marketConfig
        );
        return healthData.healthFactor <= DecimalMath.UNIT;
    }

    /**
     * @dev Returns the notional profit or loss based on current price and entry price.
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

        return
            self.size.mulDecimal(unrecordedFunding + market.currentFundingAccruedComputed - self.entryFundingAccrued);
    }

    /**
     * @dev Returns the utilization accrued from when the position was opened to now.
     */
    function getAccruedUtilization(
        Position.Data storage self,
        PerpMarket.Data storage market,
        uint256 price
    ) internal view returns (uint256) {
        if (self.size == 0) {
            return 0;
        }

        uint256 unrecordedUtilization = market.getUnrecordedUtilization();
        uint256 notional = MathUtil.abs(self.size).mulDecimal(price);
        return
            notional.mulDecimal(
                unrecordedUtilization + market.currentUtilizationAccruedComputed - self.entryUtilizationAccrued
            );
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
