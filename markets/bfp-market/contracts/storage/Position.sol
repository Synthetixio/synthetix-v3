//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {Order} from "./Order.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {PerpMarketConfiguration} from "./PerpMarketConfiguration.sol";
import {Margin} from "./Margin.sol";
import {AddressRegistry} from "./AddressRegistry.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

library Position {
    using DecimalMath for int128;
    using DecimalMath for uint128;
    using DecimalMath for uint256;
    using SafeCastU128 for uint128;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpMarket for PerpMarket.Data;

    // --- Structs --- //

    struct TradeParams {
        int128 sizeDelta;
        uint256 oraclePrice;
        uint256 pythPrice;
        uint256 fillPrice;
        uint128 makerFee;
        uint128 takerFee;
        uint256 limitPrice;
        uint128 keeperFeeBufferUsd;
    }

    struct ValidatedTrade {
        Position.Data newPosition;
        uint256 orderFee;
        uint256 keeperFee;
        uint256 newMarginUsd;
        uint256 collateralUsd;
    }

    struct HealthData {
        uint256 healthFactor;
        int128 accruedFunding;
        uint128 accruedUtilization;
        int256 pnl;
    }

    // --- Runtime structs --- //

    struct Runtime_validateLiquidation {
        address flagger;
        uint128 oldPositionSizeAbs;
        uint128 maxLiquidatableCapacity;
        uint128 remainingCapacity;
        uint128 lastLiquidationTime;
    }

    struct Runtime_validateTrade {
        uint256 orderFee;
        uint256 keeperFee;
        bool positionDecreasing;
        uint256 discountedNextMarginUsd;
        uint256 im;
        uint256 mm;
        uint256 ethPrice;
    }

    // --- Storage --- //

    /// @dev Position.Data structs are stored in PerpMarket.Data.positions.
    struct Data {
        /// Size (in native units e.g. swstETH)
        int128 size;
        /// The market's accumulated accrued funding at position settlement.
        int128 entryFundingAccrued;
        /// The market's accumulated accrued utilization at position settlement.
        uint128 entryUtilizationAccrued;
        /// The raw pyth price the order was settled with.
        uint256 entryPythPrice;
        /// The fill price at which this position was settled with.
        uint256 entryPrice;
    }

    /**
     * @dev Validates whether a change in a position's size would violate the max market value constraint.
     *
     * A perp market has one configurable variable `maxMarketSize` which constrains the maximum open interest
     * a market can have on either side.
     */
    function validateMaxOi(
        PerpMarket.Data storage market,
        uint256 maxMarketSize,
        int256 currentSize,
        int256 newSize
    ) internal view {
        // Allow users to reduce an order no matter the market conditions.
        if (
            MathUtil.sameSide(currentSize, newSize) &&
            MathUtil.abs(newSize) <= MathUtil.abs(currentSize)
        ) {
            return;
        }

        // Either the user is flipping sides, or they are increasing an order on the same side they're already on;
        // we check that the side of the market their order is on would not break the limit.
        int256 newSkew = market.skew - currentSize + newSize;
        int256 newMarketSize = (market.size - MathUtil.abs(currentSize) + MathUtil.abs(newSize))
            .toInt();

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

    /// @dev validates whether the market minimum credit has been met.
    function validateMinimumCredit(
        PerpMarket.Data storage market,
        uint256 oraclePrice,
        PerpMarketConfiguration.Data storage marketConfig,
        AddressRegistry.Data memory addresses
    ) internal view {
        uint256 minimumCredit = market.getMinimumCredit(marketConfig, oraclePrice, addresses);
        int256 delegatedCollateralValueUsd = market.getDelegatedCollateralValueUsd(addresses);

        if (
            delegatedCollateralValueUsd + market.depositedCollateral[addresses.sUsd].toInt() <
            minimumCredit.toInt()
        ) {
            revert ErrorUtil.InsufficientLiquidity();
        }
    }

    /**
     * @dev Infers the post settlement marginUsd by deducting the order and keeperFee.
     *
     * NOTE: The previous margin (which may include a discount on the collteral; used for liquidation checks) includes the
     * previous PnL, accrued funding, fees etc. We `-fee` and `-keeperFee` here as they're deducted on the settlement.
     * This is important as it helps avoid instant liquidations immediately after settlement.
     */
    function getNextMarginUsd(
        uint256 marginUsd,
        uint256 orderFee,
        uint256 keeperFee
    ) internal pure returns (uint256) {
        return MathUtil.max(marginUsd.toInt() - orderFee.toInt() - keeperFee.toInt(), 0).toUint();
    }

    /**
     * @dev Validates whether the `newPosition` can be liquidated.
     *
     * NOTE: We expect marginUsd here to be the discount adjusted margin due to liquidation checks as margin checks
     * for liquidations are expected to discount the collateral.
     */
    function validateNextPositionEnoughMargin(
        Position.Data memory newPosition,
        uint256 oraclePrice,
        uint256 im,
        uint256 mm,
        uint256 nextMarginUsd
    ) internal pure {
        // Delta between oracle and fillPrice (pos.entryPrice) may be large if settled on a very skewed market (i.e
        // a high premium paid). This can lead to instant liquidation on the settle so we deduct that difference from
        // the margin before verifying the health factor to account for the premium.
        //
        // NOTE: The `min(delta, 0)` as we only want to _reduce_ their remaining margin, not increase it in the case where
        // a discount is applied for reducing skew.
        int256 fillPremium = MathUtil.min(
            newPosition.size.mulDecimal(oraclePrice.toInt() - newPosition.entryPrice.toInt()),
            0
        );
        uint256 remainingMarginUsd = MathUtil.max(nextMarginUsd.toInt() + fillPremium, 0).toUint();

        // Check new position initial margin validations.
        if (remainingMarginUsd < im) {
            revert ErrorUtil.InsufficientMargin();
        }
    }

    /// @dev Validates whether the given `TradeParams` would lead to a valid next position.
    function validateTrade(
        uint128 accountId,
        PerpMarket.Data storage market,
        Position.TradeParams memory params,
        PerpMarketConfiguration.Data storage marketConfig,
        AddressRegistry.Data memory addresses
    ) internal view returns (Position.ValidatedTrade memory) {
        // Empty order is a no.
        if (params.sizeDelta == 0) {
            revert ErrorUtil.NilOrder();
        }

        Position.Data storage currentPosition = market.positions[accountId];
        Runtime_validateTrade memory runtime;

        // --- Existing position validation --- //

        Margin.MarginValues memory marginValuesForLiqValidation = Margin.getMarginUsd(
            accountId,
            market,
            params.oraclePrice,
            addresses
        );

        // There's an existing position. Make sure we have a valid existing position before allowing modification.
        if (currentPosition.size != 0) {
            // Position is frozen due to prior flagged for liquidation.
            if (market.flaggedLiquidations[accountId] != address(0)) {
                revert ErrorUtil.PositionFlagged();
            }

            // Determine if the current (previous) position can be immediately liquidated.
            if (
                isLiquidatable(
                    currentPosition,
                    params.oraclePrice,
                    marketConfig,
                    marginValuesForLiqValidation,
                    addresses
                )
            ) {
                revert ErrorUtil.CanLiquidatePosition();
            }
        }

        // --- New position validation (as though the order settled) --- //

        // Derive fees incurred and next position if this order were to be settled successfully.
        runtime.orderFee = Order.getOrderFee(
            params.sizeDelta,
            params.fillPrice,
            market.skew,
            params.makerFee,
            params.takerFee
        );
        runtime.ethPrice = INodeModule(addresses.oracleManager)
            .process(PerpMarketConfiguration.load().ethOracleNodeId)
            .price
            .toUint();
        runtime.keeperFee = Order.getSettlementKeeperFee(
            params.keeperFeeBufferUsd,
            runtime.ethPrice
        );
        Position.Data memory newPosition = Position.Data(
            currentPosition.size + params.sizeDelta,
            market.currentFundingAccruedComputed,
            // Since utilization wont be recomputed here we need to manually add the unrecorded utilization.
            market.currentUtilizationAccruedComputed + market.getUnrecordedUtilization(),
            params.pythPrice,
            params.fillPrice
        );

        // Minimum position margin checks. If a position is decreasing (i.e. derisking by lowering size), we
        // avoid this completely due to positions at min margin would never be allowed to lower size.
        runtime.positionDecreasing =
            MathUtil.sameSide(currentPosition.size, newPosition.size) &&
            MathUtil.abs(newPosition.size) < MathUtil.abs(currentPosition.size);
        if (!runtime.positionDecreasing) {
            // We need discounted margin collateral as we're verifying for liquidation here.
            //
            // NOTE: `marginUsd` looks at the current overall PnL but it does not consider the 'post' settled
            // incurred fees hence get `getNextMarginUsd` -fees.
            runtime.discountedNextMarginUsd = getNextMarginUsd(
                marginValuesForLiqValidation.discountedMarginUsd,
                runtime.orderFee,
                runtime.keeperFee
            );

            (runtime.im, runtime.mm) = getLiquidationMarginUsd(
                newPosition.size,
                params.oraclePrice,
                marginValuesForLiqValidation.collateralUsd,
                marketConfig,
                addresses
            );

            // Check the minimum credit requirements are still met.
            validateMinimumCredit(market, params.oraclePrice, marketConfig, addresses);

            // Check new position margin validations.
            validateNextPositionEnoughMargin(
                newPosition,
                params.oraclePrice,
                runtime.im,
                runtime.mm,
                runtime.discountedNextMarginUsd
            );

            // Check the new position hasn't hit max OI on either side.
            validateMaxOi(
                market,
                marketConfig.maxMarketSize,
                currentPosition.size,
                newPosition.size
            );
        }

        // Create and return a validated trade struct for downstream processing.
        int256 marginUsdForNextMarginUsd = marginValuesForLiqValidation.collateralUsd.toInt() +
            Margin.getPnlAdjustmentUsd(accountId, market, params.oraclePrice, params.fillPrice);
        uint256 newMarginUsd = getNextMarginUsd(
            MathUtil.max(marginUsdForNextMarginUsd, 0).toUint(),
            runtime.orderFee,
            runtime.keeperFee
        );
        return
            Position.ValidatedTrade(
                newPosition,
                runtime.orderFee,
                runtime.keeperFee,
                newMarginUsd,
                marginValuesForLiqValidation.collateralUsd
            );
    }

    /// @dev Validates whether the position at `accountId` and `marketId` would pass liquidation.
    function validateLiquidation(
        uint128 accountId,
        PerpMarket.Data storage market,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig,
        address oracleManagerAddress
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

        // Fetch the available capacity then alter if zero AND the caller is a whitelisted endorsed liquidation keeper.
        (
            runtime.maxLiquidatableCapacity,
            runtime.remainingCapacity,
            runtime.lastLiquidationTime
        ) = market.getRemainingLiquidatableSizeCapacity(marketConfig);

        if (
            ERC2771Context._msgSender() == globalConfig.keeperLiquidationEndorsed &&
            runtime.remainingCapacity == 0
        ) {
            runtime.remainingCapacity = runtime.oldPositionSizeAbs;
        }

        // At max capacity for current liquidation window.
        if (runtime.remainingCapacity == 0) {
            uint128 skewScale = marketConfig.skewScale;
            uint128 liquidationMaxPd = marketConfig.liquidationMaxPd;

            // Allow max capacity to be bypassed if the following holds true:
            //  1. remainingCapacity is zero (as parent)
            //  2. This liquidation is _not_ in the same block as the most recent liquidation
            //  3. The current market premium/discount does not exceed a configurable maxPd.
            if (
                runtime.lastLiquidationTime != block.timestamp &&
                MathUtil.abs(market.skew).divDecimal(skewScale) < liquidationMaxPd
            ) {
                runtime.remainingCapacity = runtime.oldPositionSizeAbs >
                    runtime.maxLiquidatableCapacity
                    ? runtime.maxLiquidatableCapacity
                    : runtime.oldPositionSizeAbs;
            } else {
                // No liquidation for you.
                revert ErrorUtil.LiquidationZeroCapacity();
            }
        }

        // Determine the resulting position post liquidation.
        uint256 ethPrice = INodeModule(oracleManagerAddress)
            .process(globalConfig.ethOracleNodeId)
            .price
            .toUint();
        liqSize = MathUtil.min(runtime.remainingCapacity, runtime.oldPositionSizeAbs).to128();
        liqKeeperFee = getLiquidationKeeperFee(liqSize, ethPrice, marketConfig, globalConfig);
        newPosition = Position.Data(
            oldPosition.size > 0
                ? oldPosition.size - liqSize.toInt()
                : oldPosition.size + liqSize.toInt(),
            oldPosition.entryFundingAccrued,
            oldPosition.entryUtilizationAccrued,
            oldPosition.entryPythPrice,
            oldPosition.entryPrice
        );
    }

    /// @dev Returns reward for flagging position, notionalValueUsd is `size * price`.
    function getLiquidationFlagReward(
        uint256 notionalValueUsd,
        uint256 collateralUsd,
        uint256 ethPrice,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        uint256 flagExecutionCostInUsd = ethPrice.mulDecimal(
            block.basefee * globalConfig.keeperFlagGasUnits
        );
        uint256 flagFeeInUsd = MathUtil.max(
            flagExecutionCostInUsd.mulDecimal(
                DecimalMath.UNIT + globalConfig.keeperProfitMarginPercent
            ),
            flagExecutionCostInUsd + globalConfig.keeperProfitMarginUsd
        );
        uint256 flagFeeWithRewardInUsd = flagFeeInUsd +
            MathUtil.max(notionalValueUsd, collateralUsd).mulDecimal(
                marketConfig.liquidationRewardPercent
            );

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
        int128 size,
        uint256 price,
        uint256 collateralUsd,
        PerpMarketConfiguration.Data storage marketConfig,
        AddressRegistry.Data memory addresses
    ) internal view returns (uint256 im, uint256 mm) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        // Short-circuit empty position and return zero'd values.
        if (size == 0) {
            return (0, 0);
        }

        uint128 absSize = MathUtil.abs(size).to128();
        uint256 notional = absSize.mulDecimal(price);

        uint256 imr = MathUtil.min(
            absSize.divDecimal(marketConfig.skewScale).mulDecimal(
                marketConfig.incrementalMarginScalar
            ) + marketConfig.minMarginRatio,
            marketConfig.maxInitialMarginRatio
        );
        uint256 mmr = imr.mulDecimal(marketConfig.maintenanceMarginScalar);

        uint256 ethPrice = INodeModule(addresses.oracleManager)
            .process(globalConfig.ethOracleNodeId)
            .price
            .toUint();

        uint256 liqFlagReward = getLiquidationFlagReward(
            notional,
            collateralUsd,
            ethPrice,
            marketConfig,
            globalConfig
        );

        uint256 liqKeeperFee = getLiquidationKeeperFee(
            absSize,
            ethPrice,
            marketConfig,
            globalConfig
        );

        uint256 marginAdjustment = marketConfig.minMarginUsd + liqFlagReward + liqKeeperFee;
        im = notional.mulDecimal(imr) + marginAdjustment;
        mm = notional.mulDecimal(mmr) + marginAdjustment;
    }

    /// @dev Returns the number of partial liquidations required given liquidation size and max liquidation capacity.
    function getLiquidationIterations(
        uint256 liqSize,
        uint256 maxLiqCapacity
    ) internal pure returns (uint256) {
        if (maxLiqCapacity == 0) {
            return 0;
        }

        // ceil(liqSize / maxLiqCapacity).
        uint256 quotient = liqSize / maxLiqCapacity;
        uint256 remainder = liqSize % maxLiqCapacity;
        return remainder == 0 ? quotient : quotient + 1;
    }

    /// @dev Returns fee paid to keeper for performing the liquidation (not flagging), size is liqSize or pos.size.abs
    function getLiquidationKeeperFee(
        uint128 size,
        uint256 ethPrice,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        // We exit early if size is 0, this would only happen then remaining liqcapacity is 0.
        if (size == 0) {
            return 0;
        }

        uint256 maxLiqCapacity = PerpMarket.getMaxLiquidatableCapacity(marketConfig);
        uint256 liquidationExecutionCostUsd = ethPrice.mulDecimal(
            block.basefee * globalConfig.keeperLiquidationGasUnits
        );
        uint256 liquidationFeeInUsd = MathUtil.max(
            liquidationExecutionCostUsd.mulDecimal(
                DecimalMath.UNIT + globalConfig.keeperProfitMarginPercent
            ),
            liquidationExecutionCostUsd + globalConfig.keeperProfitMarginUsd
        );
        uint256 iterations = getLiquidationIterations(size, maxLiqCapacity);

        return MathUtil.min(liquidationFeeInUsd * iterations, globalConfig.maxKeeperFeeUsd);
    }

    /// @dev Returns the health data given the `marketId`, `config`, and position{...} details.
    function getHealthData(
        PerpMarket.Data storage market,
        int128 size,
        uint256 positionEntryPrice,
        int256 positionEntryFundingAccrued,
        uint256 positionEntryUtilizationAccrued,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig,
        Margin.MarginValues memory marginValues,
        AddressRegistry.Data memory addresses
    ) internal view returns (Position.HealthData memory healthData) {
        // We can short-circuit entire getHealthData calcs when size is zero.
        if (size == 0) {
            return healthData;
        }

        (, int256 unrecordedFunding) = market.getUnrecordedFundingWithRate(price);

        healthData.accruedFunding = size
            .mulDecimal(
                unrecordedFunding +
                    market.currentFundingAccruedComputed -
                    positionEntryFundingAccrued
            )
            .to128();
        healthData.accruedUtilization = MathUtil
            .abs(size)
            .mulDecimal(price)
            .mulDecimal(
                market.getUnrecordedUtilization() +
                    market.currentUtilizationAccruedComputed -
                    positionEntryUtilizationAccrued
            )
            .to128();

        healthData.healthFactor = getHealthFactor(
            size,
            price,
            marketConfig,
            marginValues,
            addresses
        );

        // Calc the price PnL.
        healthData.pnl = size.mulDecimal(price.toInt() - positionEntryPrice.toInt());

        return healthData;
    }

    /// @dev Returns the representation of the safety between margin and position (> 1 then safe).
    function getHealthFactor(
        int128 size,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig,
        Margin.MarginValues memory marginValues,
        AddressRegistry.Data memory addresses
    ) internal view returns (uint256) {
        // `margin / mm <= 1` means liquidation.
        (, uint256 mm) = getLiquidationMarginUsd(
            size,
            price,
            marginValues.collateralUsd,
            marketConfig,
            addresses
        );
        return marginValues.discountedMarginUsd.divDecimal(mm);
    }

    // --- Member (views) --- //

    /// @dev Returns whether the current position can be liquidated.
    function isLiquidatable(
        Position.Data storage self,
        uint256 price,
        PerpMarketConfiguration.Data storage marketConfig,
        Margin.MarginValues memory marginValues,
        AddressRegistry.Data memory addresses
    ) internal view returns (bool) {
        if (self.size == 0) {
            return false;
        }
        return
            Position.getHealthFactor(self.size, price, marketConfig, marginValues, addresses) <=
            DecimalMath.UNIT;
    }

    /// @dev Returns the notional profit or loss based on current price and entry price.
    function getPricePnl(Position.Data storage self, uint256 price) internal view returns (int256) {
        if (self.size == 0) {
            return 0;
        }
        return self.size.mulDecimal(price.toInt() - self.entryPrice.toInt());
    }

    /// @dev Returns the funding accrued from when the position was opened to now.
    function getAccruedFunding(
        Position.Data storage self,
        PerpMarket.Data storage market,
        uint256 price
    ) internal view returns (int128) {
        if (self.size == 0) {
            return 0;
        }

        (, int256 unrecordedFunding) = market.getUnrecordedFundingWithRate(price);
        return
            self
                .size
                .mulDecimal(
                    unrecordedFunding +
                        market.currentFundingAccruedComputed -
                        self.entryFundingAccrued
                )
                .to128();
    }

    /// @dev Returns the utilization accrued from when the position was opened to now.
    function getAccruedUtilization(
        Position.Data storage self,
        PerpMarket.Data storage market,
        uint256 price
    ) internal view returns (uint128) {
        if (self.size == 0) {
            return 0;
        }

        uint128 unrecordedUtilization = market.getUnrecordedUtilization();
        uint256 notional = MathUtil.abs(self.size).mulDecimal(price);
        return
            notional
                .mulDecimal(
                    unrecordedUtilization +
                        market.currentUtilizationAccruedComputed -
                        self.entryUtilizationAccrued
                )
                .to128();
    }

    // --- Member (mutations) --- //

    /// @dev Clears the current position struct in-place of any stored data.
    function update(Position.Data storage self, Position.Data memory data) internal {
        self.size = data.size;
        self.entryFundingAccrued = data.entryFundingAccrued;
        self.entryUtilizationAccrued = data.entryUtilizationAccrued;
        self.entryPythPrice = data.entryPythPrice;
        self.entryPrice = data.entryPrice;
    }
}
