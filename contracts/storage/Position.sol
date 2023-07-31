//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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

    // --- Errors --- //

    // @dev Thrown when attempting to operate with an order with 0 size delta.
    error NilOrder();

    // @dev Thrown when an order pushes past a market's max allowable open interest (OI).
    error MaxMarketSizeExceeded();

    // @dev Thrown when an order pushes a position (new or current) past max market leverage.
    error MaxLeverageExceeded(uint256 leverage);

    // @dev Thrown when an account has insufficient margin to perform a trade.
    error InsufficientMargin();

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
            revert MaxMarketSizeExceeded();
        }
    }

    /**
     * @dev Given an open position (same account) and trade params return the subsequent position.
     */
    function validateTrade(
        uint128 accountId,
        uint128 marketId,
        Position.TradeParams memory params
    ) internal view returns (Position.Data memory newPosition, uint256 fee, uint256 keeperFee) {
        if (params.sizeDelta == 0) {
            revert NilOrder();
        }

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage currentPosition = market.positions[accountId];

        // Check if the `currentPosition` can be immediately liquidated.
        if (canLiquidate(currentPosition, params.fillPrice)) {
            revert ErrorUtil.CanLiquidatePosition(accountId);
        }

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // Derive fees incurred if this order were to be settled successfully.
        fee = Order.getOrderFee(params.sizeDelta, params.fillPrice, market.skew, params.makerFee, params.takerFee);
        keeperFee = Order.getKeeperFee(params.keeperFeeBufferUsd, params.oraclePrice);

        // Assuming there is an existing position (no open position will be a noop), determine if they have enough
        // margin to continue this operation. Ensuring we do not allow them to place an open position into instant
        // liquidation. This can be done by inferring their "remainingMargin".
        //
        // We do this by inferring the `remainingMargin = (sum(collateral * price)) + pnl + fundingAccrued - fee` such that
        // if remainingMargin < minMarginThreshold then this must revert.
        //
        // NOTE: The use of fillPrice and not oraclePrice to perform calculations below. Also consider this is the
        // "raw" remaining margin which does not account for fees (liquidation fees, penalties, liq premium fees etc.).
        int256 remainingMargin = getRemainingMargin(currentPosition, params.fillPrice);
        if (currentPosition.size != 0 && remainingMargin < 0) {
            revert InsufficientMargin();
        }

        // Checks whether the current position's margin (if above 0), doesn't fall below min margin for liquidations.
        if (
            MathUtil.abs(currentPosition.size) != 0 &&
            remainingMargin.toUint() <= getLiquidationMargin(currentPosition, params.fillPrice)
        ) {
            revert ErrorUtil.CanLiquidatePosition(accountId);
        }

        // --- New position (as though the order was successfully settled)! --- //

        newPosition = Position.Data({
            accountId: accountId,
            marketId: marketId,
            size: currentPosition.size + params.sizeDelta,
            entryFundingAccrued: market.currentFundingAccruedComputed,
            entryPrice: params.fillPrice,
            feesIncurredUsd: fee + keeperFee
        });
        uint256 collateralUsd = PerpCollateral.getCollateralUsd(accountId, marketId);

        // Minimum position margin checks, however if a position is decreasing (i.e. derisking by lowering size), we
        // avoid this completely due to positions at min margin would never be allowed to lower size.
        bool positionDecreasing = MathUtil.sameSide(currentPosition.size, newPosition.size) &&
            MathUtil.abs(newPosition.size) < MathUtil.abs(currentPosition.size);

        // TODO: Use getLiquidationMargins.im instead of minMarginUsd (also note the exclusion of fees in left operand).
        if (!positionDecreasing && collateralUsd < globalConfig.minMarginUsd) {
            revert InsufficientMargin();
        }

        // TODO: Check that the resulting new postion's margin is above liquidationMargin + liqPremium
        //
        // Check on liqMargin + liqPremium is from PerpsV2. This may change so leaving it TODO for now. Might add
        // this back temporarily for completeness.
        //
        // ---
        //
        // check that new position margin is above liquidation margin
        // (above, in _recomputeMarginWithDelta() we checked the old position, here we check the new one)
        //
        // Liquidation margin is considered without a fee (but including premium), because it wouldn't make sense to allow
        // a trade that will make the position liquidatable.
        //
        // note: we use `oraclePrice` here as `liquidationPremium` calcs premium based not current skew.
        // uint liqPremium = _liquidationPremium(newPos.size, params.oraclePrice);
        // uint liqMargin = _liquidationMargin(newPos.size, params.oraclePrice).add(liqPremium);
        // if (newMargin <= liqMargin) {
        //     return (newPos, 0, Status.CanLiquidate);
        // }

        // Check the new position hasn't hit max leverage.
        //
        // NOTE: We also consider including the paid fee as part of the margin, again due to UX. Otherwise,
        // maxLeverage would always below position leverage due to fees paid out to open trade. We'll allow
        // a little extra headroom for rounding errors.
        uint256 leverage = MathUtil.abs(newPosition.size).mulDecimal(params.fillPrice).divDecimal(collateralUsd);
        if (leverage > marketConfig.maxLeverage) {
            revert MaxLeverageExceeded(leverage);
        }

        // TODO: Further checks to prevent instant liquidation on the resulting newPosition.

        // Check the new position hasn't hit max OI on either side.
        validateMaxOi(marketConfig.maxMarketSize, market.skew, market.size, currentPosition.size, newPosition.size);
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
     *
     * In simple terms:
     *
     *  im = marginNotional * (abs(position.size)/skewScale + imr) + minMargin
     *  mm = marginNotional * (abs(position.size)/skewScale + mmr) + minMargin + liqReward
     *
     * NOTE: Both IM and MM are in USD and important that size is _not_ sizeDelta. It is the absolute position size.
     */
    function getLiquidationMargins(
        uint128 marketId,
        int128 size,
        uint128 skewScale,
        uint256 oraclePrice
    ) internal view returns (uint256 im, uint256 mm) {
        // No positoin means cannot infer IM/MM.
        if (size == 0) {
            return (0, 0);
        }

        uint256 absSize = MathUtil.abs(size);
        uint256 skewImpact = absSize.divDecimal(skewScale);
        uint256 notional = absSize.mulDecimal(oraclePrice);

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        uint256 minMarginUsd = globalConfig.minMarginUsd;
        uint256 liqReward = notional.mulDecimal(marketConfig.liquidationRewardPercent); // TODO: Pull into separate function for later use.

        im = notional.mulDecimal(skewImpact + marketConfig.initialMarginRatio) + minMarginUsd;
        mm = notional.mulDecimal(skewImpact + marketConfig.maintenanceMarginRatio) + minMarginUsd + liqReward;
    }

    // --- Member --- //

    /**
     * @dev Returns a position's accrued funding.
     */
    function getAccruedFunding(Position.Data storage self, uint256 price) internal view returns (int256) {
        if (self.size == 0) {
            return 0;
        }

        PerpMarket.Data storage market = PerpMarket.load(self.marketId);
        int256 netFundingPerUnit = market.getNextFunding(price) - self.entryFundingAccrued;
        return self.size.mulDecimal(netFundingPerUnit);
    }

    /**
     * @dev Return a position's remaining margin.
     *
     * The remaining margin is defined as sum(collateral * price) + PnL + funding in USD.
     *
     * We return an `int` here as after all fees and PnL, this can be negative. The caller should verify that this
     * is positive before proceeding with further operations.
     */
    function getRemainingMargin(Position.Data storage self, uint256 price) internal view returns (int256) {
        int256 margin = PerpCollateral.getCollateralUsd(self.accountId, self.marketId).toInt();
        int256 funding = getAccruedFunding(self, price);

        // Calculate this position's PnL
        int256 priceDelta = price.toInt() - self.entryPrice.toInt();
        int256 pnl = self.size.mulDecimal(priceDelta);

        // Ensure we also deduct the realized losses in fees to open trade.
        return margin + pnl + funding - self.feesIncurredUsd.toInt();
    }

    /**
     * @dev Returns a number in USD which if a position's remaining margin is lte then position can be liquidated.
     *
     * TODO: Replace this entire liquidation calc.
     */
    function getLiquidationMargin(Position.Data storage self, uint256 price) internal view returns (uint256) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(self.marketId);

        uint256 absSize = MathUtil.abs(self.size);

        // Calculates the liquidation buffer (penalty).
        //
        // e.g. 3 * 1800 * 0.0075 = 40.5
        uint256 liquidationBuffer = absSize * price * 1;

        // Calculates the liquidation fee.
        //
        // This is a fee charged against the margin on liquidation and paid to LPers. The fee is proportional to
        // the position size and bounded by `min >= liqFee <= max`. This proportion is based on each market's
        // configured liquidation fee ratio.
        //
        // e.g. 3 * 1800 * 0.0002 = 1.08
        uint256 proportionalFee = absSize * price * 1;
        uint256 maxKeeperFee = globalConfig.maxKeeperFeeUsd;
        uint256 boundedProportionalFee = proportionalFee > maxKeeperFee ? maxKeeperFee : proportionalFee;
        uint256 minKeeperFee = globalConfig.minKeeperFeeUsd;
        uint256 boundedLiquidationFee = boundedProportionalFee > minKeeperFee ? boundedProportionalFee : minKeeperFee;

        // If the remainingMargin is <= this number then position can be liquidated.
        //
        // e.g. 40.5 + 1.08 + 2 = 43.58
        return liquidationBuffer + boundedLiquidationFee + globalConfig.keeperLiquidationFeeUsd;
    }

    /**
     * @dev This is the additional premium we charge upon liquidation.
     *
     * Similar to fillPrice, but we disregard the skew (by assuming it's zero). Which is basically the calculation
     * when we compute as if taking the position from 0 to x. In practice, the premium component of the
     * liquidation will just be (size / skewScale) * (size * price).
     *
     * It adds a configurable multiplier that can be used to increase the margin that goes to feePool.
     *
     * For instance, if size of the liquidation position is 100, oracle price is 1200 and skewScale is 1M then,
     *  size    = abs(-100)
     *          = 100
     *  premium = 100 / 1,000,000 * (100 * 1200) * multiplier
     *          = 12 * multiplier
     */
    function getLiquidationPremium(Position.Data storage self, uint256 price) internal view returns (uint256) {
        if (self.size == 0) {
            return 0;
        }

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(self.marketId);
        uint256 notionalUsd = MathUtil.abs(self.size) * price;
        return (MathUtil.abs(self.size) / (marketConfig.skewScale)) * notionalUsd * 1;
    }

    /**
     * @dev Returns whether this position can be liquidated given the current `price`.
     */
    function canLiquidate(Position.Data storage self, uint256 price) internal view returns (bool) {
        // No liquidating empty positions.
        if (self.size == 0) {
            return false;
        }
        uint256 remaining = MathUtil
            .max(0, getRemainingMargin(self, price) - getLiquidationPremium(self, price).toInt())
            .toUint();
        return remaining <= getLiquidationMargin(self, price);
    }

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
