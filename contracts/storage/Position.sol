//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128, SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {Order} from "./Order.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {PerpMarketConfiguration} from "./PerpMarketConfiguration.sol";
import {PerpCollateral} from "./PerpCollateral.sol";
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

    // --- Storage --- //

    struct Data {
        // Owner of position.
        uint128 accountId;
        // Market this position belongs to (e.g. wstETHPERP)
        uint128 marketId;
        // Size (in native units e.g. wstETH)
        int128 size;
        // The market's accumulated accrued funding at position open.
        int256 entryFundingAccrued;
        // The fill price at which this position was opened with.
        uint256 entryPrice;
        // Cost in USD to open this positions (e.g. keeper + order fees).
        uint256 feesIncurredUsd;
    }

    /**
     * @dev Return whether a change in a position's size would violate the max market value constraint.
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
     * @dev Return whether the `newPosition` can be liquidated using their healthRating.
     */
    function validateNextPositionIsLiquidatable(
        Position.Data memory newPosition,
        uint256 collateralUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view {
        (uint256 healthRating, , , ) = getHealthRating(
            newPosition.marketId,
            newPosition.size,
            newPosition.entryPrice,
            newPosition.entryFundingAccrued,
            newPosition.feesIncurredUsd,
            collateralUsd,
            price,
            marketConfig
        );
        if (healthRating <= DecimalMath.UNIT) {
            revert ErrorUtil.CanLiquidatePosition(newPosition.accountId);
        }
    }

    /**
     * @dev Given an open position and trade params for the next position return the new position after validation.
     *
     * This is the core position validation pre/post order settlement. It validates the state of the current position
     * if one is available then the new position on market attributes like max OI, liquidation, margins, leverage etc.
     * When a current and new position checks pass, a new in-memory position is returned for downstream processing.
     */
    function validateTrade(
        uint128 accountId,
        PerpMarket.Data storage market,
        Position.TradeParams memory params
    ) internal view returns (Position.Data memory newPosition, uint256 fee, uint256 keeperFee) {
        // Empty order is a no.
        if (params.sizeDelta == 0) {
            revert ErrorUtil.NilOrder();
        }

        uint128 marketId = market.id;
        Position.Data storage currentPosition = market.positions[accountId];
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        uint256 collateralUsd = PerpCollateral.getCollateralUsd(accountId, marketId);

        // --- Existing position validation --- //

        // There's an existing position. Make sure we have a valid existing position before allowing modification.
        if (currentPosition.size != 0) {
            // Determine if the currentPosition can immediately be liquidated.
            if (isLiquidatable(currentPosition, collateralUsd, params.fillPrice, marketConfig)) {
                revert ErrorUtil.CanLiquidatePosition(accountId);
            }

            // Determine if the current position has enough margin to perform further changes.
            //
            // NOTE: The use of fillPrice and not oraclePrice to perform calculations below. Also consider this is the
            // "raw" remaining margin which does not account for fees (liquidation fees, penalties, liq premium fees etc.).
            (uint256 imcp, , ) = getLiquidationMarginUsd(currentPosition.size, params.fillPrice, marketConfig);
            if (collateralUsd - currentPosition.feesIncurredUsd < imcp) {
                revert ErrorUtil.InsufficientMargin();
            }
        }

        // --- New position (as though the order was successfully settled)! --- //

        // Derive fees incurred and next position if this order were to be settled successfully.
        fee = Order.getOrderFee(params.sizeDelta, params.fillPrice, market.skew, params.makerFee, params.takerFee);
        keeperFee = Order.getSettlementKeeperFee(params.keeperFeeBufferUsd);
        newPosition = Position.Data({
            accountId: accountId,
            marketId: marketId,
            size: currentPosition.size + params.sizeDelta,
            entryFundingAccrued: market.currentFundingAccruedComputed,
            entryPrice: params.fillPrice,
            feesIncurredUsd: currentPosition.feesIncurredUsd + fee + keeperFee
        });

        // Minimum position margin checks, however if a position is decreasing (i.e. derisking by lowering size), we
        // avoid this completely due to positions at min margin would never be allowed to lower size.
        bool positionDecreasing = MathUtil.sameSide(currentPosition.size, newPosition.size) &&
            MathUtil.abs(newPosition.size) < MathUtil.abs(currentPosition.size);
        (uint256 imnp, , ) = getLiquidationMarginUsd(newPosition.size, params.fillPrice, marketConfig);

        if (!positionDecreasing && collateralUsd.toInt() - newPosition.feesIncurredUsd.toInt() < imnp.toInt()) {
            revert ErrorUtil.InsufficientMargin();
        }

        // Check new position can't just be instantly liquidated.
        validateNextPositionIsLiquidatable(newPosition, collateralUsd, params.fillPrice, marketConfig);

        // Check the new position hasn't hit max OI on either side.
        validateMaxOi(marketConfig.maxMarketSize, market.skew, market.size, currentPosition.size, newPosition.size);
    }

    /**
     * @dev Given the account and position in market return a liquidated (or partially) after validation
     */
    function validateLiquidation(
        uint128 accountId,
        PerpMarket.Data storage market,
        PerpMarketConfiguration.Data storage marketConfig,
        uint256 price
    ) internal view returns (Position.Data memory newPosition, uint256 liqReward, uint256 keeperFee) {
        uint128 remainingCapacity = market.getRemainingLiquidatableCapacity(marketConfig);

        // At max capacity for current liquidation window.
        if (remainingCapacity == 0) {
            revert ErrorUtil.LiquidationZeroCapacity();
        }

        Position.Data storage position = market.positions[accountId];
        address flagger = market.flaggedLiquidations[accountId];

        // The position must be flagged first.
        if (flagger == address(0)) {
            revert ErrorUtil.PositionNotFlagged();
        }

        // Precautionary to ensure we're liquidating an open position.
        if (position.size == 0) {
            revert ErrorUtil.PositionNotFound();
        }

        // Determine the resulting position post liqudation
        int256 liquidationSize = MathUtil.min(remainingCapacity, MathUtil.abs(position.size)).toInt();
        newPosition = Position.Data({
            accountId: accountId,
            marketId: position.marketId,
            size: (position.size > 0 ? position.size - liquidationSize : position.size + liquidationSize).to128(),
            entryFundingAccrued: position.entryFundingAccrued,
            entryPrice: position.entryPrice,
            feesIncurredUsd: position.feesIncurredUsd
        });

        // TODO: Maybe have a separate fn for liqReward?
        (, , liqReward) = getLiquidationMarginUsd(position.size, price, marketConfig);
        keeperFee = getLiquidationKeeperFee();
    }

    /**
     * @dev Given the necessary market details return the IM and MM for a specified position size.
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
        uint256 absSize = MathUtil.abs(positionSize);
        uint256 notional = absSize.mulDecimal(price);

        uint256 imr = absSize.divDecimal(marketConfig.skewScale).mulDecimal(marketConfig.incrementalMarginScalar) +
            marketConfig.minMarginRatio;
        uint256 mmr = imr.mulDecimal(marketConfig.maintenanceMarginScalar);

        liqReward = notional.mulDecimal(marketConfig.liquidationRewardPercent); // TODO: Include liqRewardKeeperFee (maybe?)
        im = notional.mulDecimal(imr) + marketConfig.minMarginUsd;
        mm = notional.mulDecimal(mmr) + marketConfig.minMarginUsd + liqReward;
    }

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
     * @dev Given the marketId, config, and position{...} details, retrieve the health rating.
     */
    function getHealthRating(
        uint128 marketId,
        int128 positionSize,
        uint256 positionEntryPrice,
        int256 positionEntryFundingAccrued,
        uint256 positionFeesIncurredUsd,
        uint256 collateralUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256 healthRating, int256 accruedFunding, int256 pnl, uint256 remainingMarginUsd) {
        PerpMarket.Data storage market = PerpMarket.load(marketId);
        int256 netFundingPerUnit = market.getNextFunding(price) - positionEntryFundingAccrued;
        accruedFunding = positionSize.mulDecimal(netFundingPerUnit);

        // Calculate this position's PnL
        pnl = positionSize.mulDecimal(price.toInt() - positionEntryPrice.toInt());

        // Ensure we also deduct the realized losses in fees to open trade.
        //
        // The remaining margin is defined as sum(collateral * price) + PnL + funding in USD.
        remainingMarginUsd = MathUtil
            .max(collateralUsd.toInt() + pnl + accruedFunding - positionFeesIncurredUsd.toInt(), 0)
            .toUint();

        // margin / mm <= 1 means liquidation.
        (, uint256 mm, ) = getLiquidationMarginUsd(positionSize, price, marketConfig);
        healthRating = remainingMarginUsd.divDecimal(mm);
    }

    // --- Member (views) --- //

    /**
     * @dev Determines the current position with additional details can be liquidated.
     */
    function isLiquidatable(
        Position.Data storage self,
        uint256 collateralUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (bool) {
        if (self.size == 0) {
            return false;
        }
        (uint256 healthRating, , , ) = getHealthRating(
            self.marketId,
            self.size,
            self.entryPrice,
            self.entryFundingAccrued,
            self.feesIncurredUsd,
            collateralUsd,
            price,
            marketConfig
        );
        return healthRating <= DecimalMath.UNIT;
    }

    /**
     * @dev An overloaded function over `getHealthRating` using the a Position storage struct.
     */
    function getHealthRating(
        Position.Data storage self,
        uint256 collateralUsd,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint256) {
        (uint256 healthRating, , , ) = getHealthRating(
            self.marketId,
            self.size,
            self.entryPrice,
            self.entryFundingAccrued,
            self.feesIncurredUsd,
            collateralUsd,
            price,
            marketConfig
        );
        return healthRating;
    }

    // --- Member (mutative) --- //

    /**
     * @dev Clears the current position struct in-place of any stored data.
     */
    function update(Position.Data storage self, Position.Data memory data) internal {
        self.accountId = data.accountId;
        self.marketId = data.marketId;
        self.size = data.size;
        self.entryFundingAccrued = data.entryFundingAccrued;
        self.entryPrice = data.entryPrice;
        self.feesIncurredUsd = data.feesIncurredUsd;
    }
}
