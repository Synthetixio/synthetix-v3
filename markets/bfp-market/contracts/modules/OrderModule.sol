//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI128, SafeCastI256, SafeCastU128, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IOrderModule} from "../interfaces/IOrderModule.sol";
import {ISettlementHook} from "../interfaces/hooks/ISettlementHook.sol";
import {Margin} from "../storage/Margin.sol";
import {Order} from "../storage/Order.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PythUtil} from "../utils/PythUtil.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {Flags} from "../utils/Flags.sol";

/* solhint-disable meta-transactions/no-msg-sender */

contract OrderModule is IOrderModule {
    using DecimalMath for int256;
    using DecimalMath for int128;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastU128 for uint128;
    using Order for Order.Data;
    using Position for Position.Data;
    using PerpMarket for PerpMarket.Data;
    using Margin for Margin.Data;

    // --- Runtime structs --- //

    struct Runtime_settleOrder {
        uint256 pythPrice;
        int256 accruedFunding;
        int256 pnl;
        uint256 fillPrice;
        uint128 accountDebt;
        uint128 updatedMarketSize;
        int128 updatedMarketSkew;
        Position.ValidatedTrade trade;
        Position.TradeParams params;
    }

    // --- Helpers --- //

    /**
     * @dev Reverts when `fillPrice > limitPrice` when long or `fillPrice < limitPrice` when short.
     */
    function isPriceToleranceExceeded(
        int128 sizeDelta,
        uint256 fillPrice,
        uint256 limitPrice
    ) private pure returns (bool) {
        return
            (sizeDelta > 0 && fillPrice > limitPrice) || (sizeDelta < 0 && fillPrice < limitPrice);
    }

    /**
     * @dev A stale order is one where time passed is max age or older (>=).
     */
    function isOrderStale(uint256 commitmentTime, uint256 maxOrderAge) private view returns (bool) {
        return block.timestamp - commitmentTime >= maxOrderAge;
    }

    /**
     * @dev Amount of time that has passed must be at least the minimum order age (>=).
     */
    function isOrderReady(uint256 commitmentTime, uint256 minOrderAge) private view returns (bool) {
        return block.timestamp - commitmentTime >= minOrderAge;
    }

    /**
     * @dev Validates that an order can only be settled iff time and price is acceptable.
     */
    function validateOrderPriceReadiness(
        PerpMarketConfiguration.GlobalData storage globalConfig,
        uint256 commitmentTime,
        Position.TradeParams memory params
    ) private view {
        if (isOrderStale(commitmentTime, globalConfig.maxOrderAge)) {
            revert ErrorUtil.OrderStale();
        }
        if (!isOrderReady(commitmentTime, globalConfig.minOrderAge)) {
            revert ErrorUtil.OrderNotReady();
        }

        // Do not accept zero prices.
        if (params.oraclePrice == 0) {
            revert ErrorUtil.InvalidPrice();
        }
        if (isPriceToleranceExceeded(params.sizeDelta, params.fillPrice, params.limitPrice)) {
            revert ErrorUtil.PriceToleranceExceeded(
                params.sizeDelta,
                params.fillPrice,
                params.limitPrice
            );
        }
    }

    /**
     * @dev Validates that the hooks specified during commitment are valid and acceptable.
     */
    function validateOrderHooks(address[] memory hooks) private view {
        uint256 length = hooks.length;

        if (length == 0) {
            return;
        }

        SettlementHookConfiguration.GlobalData storage config = SettlementHookConfiguration.load();

        if (length > config.maxHooksPerOrder) {
            revert ErrorUtil.MaxHooksExceeded();
        }

        for (uint256 i = 0; i < length; ) {
            if (!config.whitelisted[hooks[i]]) {
                revert ErrorUtil.InvalidHook(hooks[i]);
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Executes the hooks supplied in the order commitment.
     */
    function executeOrderHooks(
        uint128 accountId,
        uint128 marketId,
        Order.Data storage order,
        Position.Data memory newPosition,
        uint256 fillPrice
    ) private {
        uint256 length = order.hooks.length;

        if (length == 0) {
            return;
        }

        for (uint256 i = 0; i < length; ) {
            address hook = order.hooks[i];

            ISettlementHook(hook).onSettle(
                accountId,
                marketId,
                order.sizeDelta,
                newPosition.size,
                fillPrice
            );
            emit OrderSettlementHookExecuted(accountId, marketId, hook);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Generic helper for funding recomputation during order management.
     */
    function recomputeUtilization(PerpMarket.Data storage market, uint256 price) private {
        (uint256 utilizationRate, ) = market.recomputeUtilization(price);
        emit UtilizationRecomputed(market.id, market.skew, utilizationRate);
    }

    /**
     * @dev Generic helper for funding recomputation during order management.
     */
    function recomputeFunding(PerpMarket.Data storage market, uint256 price) private {
        (int256 fundingRate, ) = market.recomputeFunding(price);
        emit FundingRecomputed(
            market.id,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );
    }

    // --- Mutations --- //

    /**
     * @inheritdoc IOrderModule
     */
    function commitOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint256 keeperFeeBufferUsd,
        address[] memory hooks
    ) external {
        FeatureFlag.ensureAccessToFeature(Flags.COMMIT_ORDER);

        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION
        );

        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        validateOrderHooks(hooks);

        uint256 oraclePrice = market.getOraclePrice();

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        //
        // NOTE: `fee` here does _not_ matter. We recompute the actual order fee on settlement. The same is true for
        // the keeper fee. These fees provide an approximation on remaining margin and hence infer whether the subsequent
        // order will reach liquidation or insufficient margin for the desired leverage.
        Position.ValidatedTrade memory trade = Position.validateTrade(
            accountId,
            market,
            Position.TradeParams(
                sizeDelta,
                oraclePrice,
                Order.getFillPrice(market.skew, marketConfig.skewScale, sizeDelta, oraclePrice),
                marketConfig.makerFee,
                marketConfig.takerFee,
                limitPrice,
                keeperFeeBufferUsd
            )
        );

        market.orders[accountId].update(
            Order.Data(sizeDelta, block.timestamp, limitPrice, keeperFeeBufferUsd, hooks)
        );
        emit OrderCommitted(
            accountId,
            marketId,
            block.timestamp,
            sizeDelta,
            trade.orderFee,
            trade.keeperFee
        );
    }

    /**
     * @inheritdoc IOrderModule
     */
    function settleOrder(
        uint128 accountId,
        uint128 marketId,
        bytes calldata priceUpdateData
    ) external payable {
        FeatureFlag.ensureAccessToFeature(Flags.SETTLE_ORDER);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        Order.Data storage order = market.orders[accountId];
        Position.Data storage position = market.positions[accountId];
        Runtime_settleOrder memory runtime;

        // No order available to settle.
        if (order.sizeDelta == 0) {
            revert ErrorUtil.OrderNotFound();
        }

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        runtime.pythPrice = PythUtil.parsePythPrice(
            globalConfig,
            marketConfig,
            order.commitmentTime,
            priceUpdateData
        );
        runtime.fillPrice = Order.getFillPrice(
            market.skew,
            marketConfig.skewScale,
            order.sizeDelta,
            runtime.pythPrice
        );
        runtime.params = Position.TradeParams(
            order.sizeDelta,
            runtime.pythPrice,
            runtime.fillPrice,
            marketConfig.makerFee,
            marketConfig.takerFee,
            order.limitPrice,
            order.keeperFeeBufferUsd
        );

        validateOrderPriceReadiness(globalConfig, order.commitmentTime, runtime.params);
        recomputeFunding(market, runtime.pythPrice);

        runtime.trade = Position.validateTrade(accountId, market, runtime.params);

        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            runtime.fillPrice
        );

        // We call `getHeathData` here to fetch accrued utilisation before utilisation recomputation.
        Position.HealthData memory healthData = Position.getHealthData(
            market,
            position.size,
            position.entryPrice,
            position.entryFundingAccrued,
            position.entryUtilizationAccrued,
            runtime.fillPrice,
            marketConfig,
            // The margins passed here are missing the order fee + keeper fee for this trade. runtime.trade.newMarginUsd would be correct.
            // But we are only calling getHealthData to get accruedFunding, accruedUtilisation and pnl. So we can use the old margin values.
            marginValues
        );

        runtime.updatedMarketSize = (market.size.to256() +
            MathUtil.abs(runtime.trade.newPosition.size) -
            MathUtil.abs(position.size)).to128();
        runtime.updatedMarketSkew = market.skew + runtime.trade.newPosition.size - position.size;
        market.skew = runtime.updatedMarketSkew;
        market.size = runtime.updatedMarketSize;

        // We want to validateTrade and update market size before we recompute utilisation
        // 1. The validateTrade call getMargin to figure out the new margin, this should be using the utilisation rate up to this point
        // 2. The new utlization rate is calculated using the new maret size, so we need to update the size before we recompute utilisation
        recomputeUtilization(market, runtime.pythPrice);

        market.updateDebtCorrection(position, runtime.trade.newPosition);

        // Update collateral used for margin if necessary. We only perform this if modifying an existing position.
        if (position.size != 0) {
            Margin.Data storage accountMargin = Margin.load(accountId, marketId);
            accountMargin.updateAccountDebtAndCollateral(
                market,
                // What is `newMarginUsd`?
                //
                // (oldMargin - orderFee - keeperFee). Where oldMargin has pnl (from entry price changes), accruedFunding,
                // accruedUtilisation, debt, and previous fees taken into account. We use `collateralUsd` and not `marginUsd`
                // as we dont want price impact to be deducted yet.
                //
                // TLDR; This is basically the `total realised PnL` for this position.
                runtime.trade.newMarginUsd.toInt() - marginValues.collateralUsd.toInt()
            );

            runtime.accountDebt = accountMargin.debtUsd;
        }

        if (runtime.trade.newPosition.size == 0) {
            delete market.positions[accountId];
        } else {
            market.positions[accountId].update(runtime.trade.newPosition);
        }

        // Keeper fees can be set to zero.
        if (runtime.trade.keeperFee > 0) {
            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, runtime.trade.keeperFee);
        }

        emit OrderSettled(
            accountId,
            marketId,
            block.timestamp,
            runtime.params.sizeDelta,
            runtime.trade.orderFee,
            runtime.trade.keeperFee,
            healthData.accruedFunding,
            healthData.accruedUtilization,
            healthData.pnl,
            runtime.fillPrice,
            runtime.accountDebt
        );

        emit MarketSizeUpdated(marketId, runtime.updatedMarketSize, runtime.updatedMarketSkew);

        // Validate and perform the hook post settlement execution.
        validateOrderHooks(order.hooks);
        executeOrderHooks(accountId, marketId, order, runtime.trade.newPosition, runtime.fillPrice);

        // Wipe the order, successfully settled!
        delete market.orders[accountId];
    }

    /**
     * @inheritdoc IOrderModule
     */
    function cancelStaleOrder(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.CANCEL_ORDER);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta == 0) {
            revert ErrorUtil.OrderNotFound();
        }

        if (!isOrderStale(order.commitmentTime, PerpMarketConfiguration.load().maxOrderAge)) {
            revert ErrorUtil.OrderNotStale();
        }

        emit OrderCanceled(accountId, marketId, 0, order.commitmentTime);
        delete market.orders[accountId];
    }

    /**
     * @inheritdoc IOrderModule
     */
    function cancelOrder(
        uint128 accountId,
        uint128 marketId,
        bytes calldata priceUpdateData
    ) external payable {
        FeatureFlag.ensureAccessToFeature(Flags.CANCEL_ORDER);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Account.Data storage account = Account.exists(accountId);

        Order.Data storage order = market.orders[accountId];

        // No order available to settle.
        if (order.sizeDelta == 0) {
            revert ErrorUtil.OrderNotFound();
        }
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        if (!isOrderReady(order.commitmentTime, globalConfig.minOrderAge)) {
            revert ErrorUtil.OrderNotReady();
        }
        bool isAccountOwner = msg.sender == account.rbac.owner;

        // Only do the price divergence check for non stale orders. All stale orders are allowed to be canceled.
        if (!isOrderStale(order.commitmentTime, globalConfig.maxOrderAge)) {
            // Order is within settlement window. Check if price tolerance has exceeded.
            uint256 pythPrice = PythUtil.parsePythPrice(
                globalConfig,
                marketConfig,
                order.commitmentTime,
                priceUpdateData
            );
            uint256 fillPrice = Order.getFillPrice(
                market.skew,
                marketConfig.skewScale,
                order.sizeDelta,
                pythPrice
            );

            if (!isPriceToleranceExceeded(order.sizeDelta, fillPrice, order.limitPrice)) {
                revert ErrorUtil.PriceToleranceNotExceeded(
                    order.sizeDelta,
                    fillPrice,
                    order.limitPrice
                );
            }
        }

        uint256 keeperFee = isAccountOwner
            ? 0
            : Order.getSettlementKeeperFee(order.keeperFeeBufferUsd);
        if (keeperFee > 0) {
            Margin.load(accountId, marketId).updateAccountDebtAndCollateral(
                market,
                -keeperFee.toInt()
            );

            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, keeperFee);
        }

        emit OrderCanceled(accountId, marketId, keeperFee, order.commitmentTime);
        delete market.orders[accountId];
    }

    // --- Views --- //

    /**
     * @inheritdoc IOrderModule
     */
    function getOrderDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (Order.Data memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return market.orders[accountId];
    }

    /**
     * @inheritdoc IOrderModule
     */
    function getOrderFees(
        uint128 marketId,
        int128 sizeDelta,
        uint256 keeperFeeBufferUsd
    ) external view returns (uint256 orderFee, uint256 keeperFee) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        orderFee = Order.getOrderFee(
            sizeDelta,
            Order.getFillPrice(
                market.skew,
                marketConfig.skewScale,
                sizeDelta,
                market.getOraclePrice()
            ),
            market.skew,
            marketConfig.makerFee,
            marketConfig.takerFee
        );
        keeperFee = Order.getSettlementKeeperFee(keeperFeeBufferUsd);
    }

    /**
     * @inheritdoc IOrderModule
     */
    function getFillPrice(uint128 marketId, int128 size) external view returns (uint256) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return
            Order.getFillPrice(
                market.skew,
                PerpMarketConfiguration.load(marketId).skewScale,
                size,
                market.getOraclePrice()
            );
    }

    /**
     * @inheritdoc IOrderModule
     */
    function getOraclePrice(uint128 marketId) external view returns (uint256) {
        return PerpMarket.exists(marketId).getOraclePrice();
    }
}
