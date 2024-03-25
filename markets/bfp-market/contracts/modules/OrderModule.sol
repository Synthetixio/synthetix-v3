//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI128, SafeCastI256, SafeCastU128, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
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
        uint256 fillPrice;
        uint128 updatedMarketSize;
        int128 updatedMarketSkew;
        uint128 totalFees;
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
     * @dev Returns true/false for both order staleness and readiness.
     *
     * A stale order is one where time passed is max age or older (>=).
     * A ready order is one where time that has passed must be at least the minimum order age (>=).
     */
    function isOrderStaleOrReady(
        uint256 commitmentTime,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private view returns (bool isStale, bool isReady) {
        uint256 timestamp = block.timestamp;
        isStale = timestamp - commitmentTime >= globalConfig.maxOrderAge;
        isReady = timestamp - commitmentTime >= globalConfig.minOrderAge;
    }

    /**
     * @dev Validates that an order can only be settled if time and price are acceptable.
     */
    function validateOrderPriceReadiness(
        PerpMarketConfiguration.GlobalData storage globalConfig,
        uint256 commitmentTime,
        Position.TradeParams memory params
    ) private view {
        (bool isStale, bool isReady) = isOrderStaleOrReady(commitmentTime, globalConfig);
        if (isStale) {
            revert ErrorUtil.OrderStale();
        }
        if (!isReady) {
            revert ErrorUtil.OrderNotReady();
        }
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
        address[] memory hooks,
        uint256 oraclePrice
    ) private {
        uint256 length = hooks.length;
        if (length == 0) {
            return;
        }

        SettlementHookConfiguration.GlobalData storage config = SettlementHookConfiguration.load();

        for (uint256 i = 0; i < length; ) {
            address hook = hooks[i];

            // Verify the hook is still whitelisted between commitment and settlement.
            if (!config.whitelisted[hooks[i]]) {
                revert ErrorUtil.InvalidHook(hooks[i]);
            }

            ISettlementHook(hook).onSettle(accountId, marketId, oraclePrice);
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

        // We call `getHeathData` here to fetch _current_ accrued utilization before utilization recomputation.
        Position.HealthData memory healthData = Position.getHealthData(
            market,
            position.size,
            position.entryPrice,
            position.entryFundingAccrued,
            position.entryUtilizationAccrued,
            runtime.fillPrice,
            marketConfig,
            // NOTE: The margins passed here are missing the order fee + keeper fee for this trade (as they are calc
            // before settlement), ref `runtime.trade.newMarginUsd` for correct next marginUsd.
            //
            // However, call to `getHealthData` is only for `accruedFunding`, `accruedUtilization` and PnL for the settlement
            // event below so it's fine to use the old margin values.
            runtime.trade.marginValues
        );

        runtime.updatedMarketSize = (market.size.to256() +
            MathUtil.abs(runtime.trade.newPosition.size) -
            MathUtil.abs(position.size)).to128();
        runtime.updatedMarketSkew = market.skew + runtime.trade.newPosition.size - position.size;
        market.skew = runtime.updatedMarketSkew;
        market.size = runtime.updatedMarketSize;

        // We want to validateTrade and update market size before we recompute utilization
        // 1. The validateTrade call getMargin to figure out the new margin, this should be using the utilization rate up to this point
        // 2. The new utilization rate is calculated using the new market size, so we need to update the size before we recompute utilization
        recomputeUtilization(market, runtime.pythPrice);

        market.updateDebtCorrection(position, runtime.trade.newPosition);

        // Account debt and market total trader debt must be updated with fees incurred to settle.
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);
        runtime.totalFees = (runtime.trade.orderFee + runtime.trade.keeperFee).to128();
        accountMargin.debtUsd += runtime.totalFees;
        market.totalTraderDebtUsd += runtime.totalFees;

        // Update collateral used for margin if necessary. We only perform this if modifying an existing position.
        if (position.size != 0) {
            accountMargin.updateAccountDebtAndCollateral(
                market,
                // What is `newMarginUsd`?
                //
                // (oldMargin - orderFee - keeperFee). Where oldMargin has pnl (from entry price changes), accruedFunding,
                // accruedUtilization, debt, and previous fees taken into account. We use `collateralUsd` and not `marginUsd`
                // as we dont want price impact to be deducted yet.
                //
                // TLDR; This is basically the `total realised PnL` for this position.
                runtime.trade.newMarginUsd.toInt() -
                    runtime.trade.marginValues.collateralUsd.toInt()
            );
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
            accountMargin.debtUsd
        );

        emit MarketSizeUpdated(marketId, runtime.updatedMarketSize, runtime.updatedMarketSkew);

        // Execute any hooks on the order that may exist.
        //
        // First, copying any existing hooks that may be present in the commitment (up to maxHooksPerOrder). Then,
        // deleting the order from market, and finally invoking each hook's `onSettle` callback.
        address[] memory hooks = order.cloneSettlementHooks();
        delete market.orders[accountId];
        executeOrderHooks(accountId, marketId, hooks, runtime.pythPrice);
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

        uint256 commitmentTime = order.commitmentTime;
        (bool isStale, ) = isOrderStaleOrReady(commitmentTime, PerpMarketConfiguration.load());

        if (!isStale) {
            revert ErrorUtil.OrderNotStale();
        }

        emit OrderCanceled(accountId, marketId, 0, commitmentTime);
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

        uint256 commitmentTime = order.commitmentTime;
        (bool isStale, bool isReady) = isOrderStaleOrReady(commitmentTime, globalConfig);

        if (!isReady) {
            revert ErrorUtil.OrderNotReady();
        }

        // Only do the price divergence check for non stale orders. All stale orders are allowed to be canceled.
        if (!isStale) {
            PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(
                marketId
            );

            // Order is within settlement window. Check if price tolerance has exceeded.
            uint256 pythPrice = PythUtil.parsePythPrice(
                globalConfig,
                marketConfig,
                commitmentTime,
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

        // If `isAccountOwner` then 0 else chargeFee.
        uint256 keeperFee = msg.sender == account.rbac.owner
            ? 0
            : Order.getSettlementKeeperFee(order.keeperFeeBufferUsd);

        if (keeperFee > 0) {
            Margin.load(accountId, marketId).updateAccountDebtAndCollateral(
                market,
                -keeperFee.toInt()
            );
            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, keeperFee);
        }

        emit OrderCanceled(accountId, marketId, keeperFee, commitmentTime);
        delete market.orders[accountId];
    }

    // --- Views --- //

    /**
     * @inheritdoc IOrderModule
     */
    function getOrderDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IOrderModule.OrderDigest memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        // no-op rather than revert.
        if (order.sizeDelta == 0) {
            IOrderModule.OrderDigest memory emptyOrderDigest;
            return emptyOrderDigest;
        }

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        uint256 commitmentTime = order.commitmentTime;
        (bool isStale, bool isReady) = isOrderStaleOrReady(commitmentTime, globalConfig);

        return
            IOrderModule.OrderDigest(
                order.sizeDelta,
                commitmentTime,
                order.limitPrice,
                order.keeperFeeBufferUsd,
                order.hooks,
                isStale,
                isReady
            );
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
