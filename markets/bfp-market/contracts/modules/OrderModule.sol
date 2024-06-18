//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI128, SafeCastI256, SafeCastU128, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IOrderModule} from "../interfaces/IOrderModule.sol";
import {ISettlementHook} from "../interfaces/hooks/ISettlementHook.sol";
import {Margin} from "../storage/Margin.sol";
import {Order} from "../storage/Order.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {AddressRegistry} from "../storage/AddressRegistry.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PythUtil} from "../utils/PythUtil.sol";
import {Flags} from "../utils/Flags.sol";

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

    // --- Immutables --- //

    address immutable SYNTHETIX_CORE;
    address immutable SYNTHETIX_SUSD;
    address immutable ORACLE_MANAGER;

    constructor(address _synthetix) {
        SYNTHETIX_CORE = _synthetix;
        ISynthetixSystem core = ISynthetixSystem(_synthetix);
        SYNTHETIX_SUSD = address(core.getUsdToken());
        ORACLE_MANAGER = address(core.getOracleManager());

        if (
            _synthetix == address(0) || ORACLE_MANAGER == address(0) || SYNTHETIX_SUSD == address(0)
        ) {
            revert ErrorUtil.InvalidCoreAddress(_synthetix);
        }
    }

    // --- Runtime structs --- //

    struct Runtime_commitOrder {
        uint256 oraclePrice;
        uint64 commitmentTime;
        AddressRegistry.Data addresses;
    }

    struct Runtime_settleOrder {
        uint256 pythPrice;
        int128 accruedFunding;
        uint128 accruedUtilization;
        int256 pricePnl;
        uint256 fillPrice;
        uint128 updatedMarketSize;
        int128 updatedMarketSkew;
        uint128 totalFees;
        Position.TradeParams tradeParams;
    }

    // --- Helpers --- //

    /// @dev Reverts when `fillPrice > limitPrice` when long or `fillPrice < limitPrice` when short.
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
        uint64 commitmentTime,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private view returns (bool isStale, bool isReady) {
        uint64 timestamp = block.timestamp.to64();
        isStale = timestamp - commitmentTime >= globalConfig.maxOrderAge;
        isReady = timestamp - commitmentTime >= globalConfig.minOrderAge;
    }

    /// @dev Validates that an order can only be settled if time and price are acceptable.
    function validateOrderPriceReadiness(
        PerpMarketConfiguration.GlobalData storage globalConfig,
        uint64 commitmentTime,
        uint256 pythPrice,
        Position.TradeParams memory params
    ) private view {
        (bool isStale, bool isReady) = isOrderStaleOrReady(commitmentTime, globalConfig);
        if (isStale) {
            revert ErrorUtil.OrderStale();
        }
        if (!isReady) {
            revert ErrorUtil.OrderNotReady();
        }
        if (pythPrice == 0) {
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

    /// @dev Validates that the hooks specified during commitment are valid and acceptable.
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

    /// @dev Executes the hooks supplied in the order commitment.
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

    /// @dev Generic helper for utilization recomputation during order management.
    function recomputeUtilization(PerpMarket.Data storage market, uint256 price) private {
        (uint128 utilizationRate, ) = market.recomputeUtilization(
            price,
            AddressRegistry.Data({
                synthetix: ISynthetixSystem(SYNTHETIX_CORE),
                sUsd: SYNTHETIX_SUSD,
                oracleManager: ORACLE_MANAGER
            })
        );
        emit UtilizationRecomputed(market.id, market.skew, utilizationRate);
    }

    /// @dev Generic helper for funding recomputation during order management.
    function recomputeFunding(PerpMarket.Data storage market, uint256 price) private {
        (int128 fundingRate, ) = market.recomputeFunding(price);
        emit FundingRecomputed(
            market.id,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );
    }

    // --- Mutations --- //

    /// @inheritdoc IOrderModule
    function commitOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint128 keeperFeeBufferUsd,
        address[] memory hooks,
        bytes32 trackingCode
    ) external {
        FeatureFlag.ensureAccessToFeature(Flags.COMMIT_ORDER);

        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION
        );
        Runtime_commitOrder memory runtime;

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        runtime.addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        validateOrderHooks(hooks);

        runtime.oraclePrice = market.getOraclePrice(runtime.addresses);

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // NOTE: `oraclePrice` in TradeParams should be `pythPrice` as to track the raw Pyth price on settlement. However,
        // we are only committing the order and the `trade.newPosition` is discarded so it does not matter here.
        Position.TradeParams memory tradeParams = Position.TradeParams(
            sizeDelta,
            runtime.oraclePrice, // Pyth oracle price (but is also CL oracle price on commitment).
            runtime.oraclePrice, // CL oracle price.
            Order.getFillPrice(market.skew, marketConfig.skewScale, sizeDelta, runtime.oraclePrice),
            marketConfig.makerFee,
            marketConfig.takerFee,
            limitPrice,
            keeperFeeBufferUsd
        );

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        //
        // NOTE: `fee` here does _not_ matter. We recompute the actual order fee on settlement. The same is true for
        // the keeper fee. These fees provide an approximation on remaining margin and hence infer whether the subsequent
        // order will reach liquidation or insufficient margin for the desired leverage.
        Position.ValidatedTrade memory trade = Position.validateTrade(
            accountId,
            market,
            tradeParams,
            marketConfig,
            runtime.addresses
        );

        runtime.commitmentTime = block.timestamp.to64();
        market.orders[accountId].update(
            Order.Data(sizeDelta, runtime.commitmentTime, limitPrice, keeperFeeBufferUsd, hooks)
        );

        emit OrderCommitted(
            accountId,
            marketId,
            runtime.commitmentTime,
            sizeDelta,
            trade.orderFee,
            trade.keeperFee,
            trackingCode
        );
    }

    /// @inheritdoc IOrderModule
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
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
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
        runtime.tradeParams = Position.TradeParams(
            order.sizeDelta,
            market.getOraclePrice(addresses),
            runtime.pythPrice,
            runtime.fillPrice,
            marketConfig.makerFee,
            marketConfig.takerFee,
            order.limitPrice,
            order.keeperFeeBufferUsd
        );

        validateOrderPriceReadiness(
            globalConfig,
            order.commitmentTime,
            runtime.pythPrice,
            runtime.tradeParams
        );
        recomputeFunding(market, runtime.tradeParams.oraclePrice);

        Position.ValidatedTrade memory trade = Position.validateTrade(
            accountId,
            market,
            runtime.tradeParams,
            marketConfig,
            addresses
        );

        runtime.updatedMarketSize = (market.size.to256() +
            MathUtil.abs(trade.newPosition.size) -
            MathUtil.abs(position.size)).to128();
        runtime.updatedMarketSkew = market.skew + trade.newPosition.size - position.size;
        market.skew = runtime.updatedMarketSkew;
        market.size = runtime.updatedMarketSize;

        // We want to validateTrade and update market size before we recompute utilization
        // 1. The validateTrade call getMargin to figure out the new margin, this should be using the utilization rate up to this point
        // 2. The new utilization rate is calculated using the new market size, so we need to update the size before we recompute utilization
        recomputeUtilization(market, runtime.tradeParams.oraclePrice);

        market.updateDebtCorrection(position, trade.newPosition);

        // Account debt and market total trader debt must be updated with fees incurred to settle.
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);
        runtime.totalFees = (trade.orderFee + trade.keeperFee).to128();
        accountMargin.debtUsd += runtime.totalFees;
        market.totalTraderDebtUsd += runtime.totalFees;

        // Update collateral used for margin if necessary. We only perform this if modifying an existing position.
        if (position.size != 0) {
            accountMargin.realizeAccountPnlAndUpdate(
                market,
                // `newMarginUsd` is (oldMargin - orderFee - keeperFee).
                //
                // Where `oldMargin` includes price PnL, accrued funding/util, account debt, and prev fees. We sub
                // `collateralUsd` (opposed to `marginUsd`) here because `newMarginUsd` already considers this settlement
                // fees and we want to avoid attributing price PnL (due to pd adjusted oracle price) now as its already
                // tracked in the new position price PnL.
                //
                // The value passed is then just realized profits/losses of previous position, including fees paid during
                // this order settlement.
                trade.newMarginUsd.toInt() - trade.collateralUsd.toInt(),
                addresses
            );
        }
        // Before updating/clearing the position, grab accrued funding, accrued util and pnl.
        runtime.accruedFunding = position.getAccruedFunding(
            market,
            runtime.tradeParams.oraclePrice
        );
        runtime.accruedUtilization = position.getAccruedUtilization(
            market,
            runtime.tradeParams.oraclePrice
        );
        runtime.pricePnl = position.getPricePnl(runtime.tradeParams.fillPrice);

        if (trade.newPosition.size == 0) {
            delete market.positions[accountId];
        } else {
            position.update(trade.newPosition);
        }

        // Keeper fees can be set to zero.
        if (trade.keeperFee > 0) {
            addresses.synthetix.withdrawMarketUsd(
                marketId,
                ERC2771Context._msgSender(),
                trade.keeperFee
            );
        }
        emit OrderSettled(
            accountId,
            marketId,
            block.timestamp.to64(),
            runtime.tradeParams.sizeDelta,
            trade.orderFee,
            trade.keeperFee,
            runtime.accruedFunding,
            runtime.accruedUtilization,
            runtime.pricePnl,
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

    /// @inheritdoc IOrderModule
    function cancelStaleOrder(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.CANCEL_ORDER);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        if (order.sizeDelta == 0) {
            revert ErrorUtil.OrderNotFound();
        }

        uint64 commitmentTime = order.commitmentTime;
        (bool isStale, ) = isOrderStaleOrReady(commitmentTime, PerpMarketConfiguration.load());

        if (!isStale) {
            revert ErrorUtil.OrderNotStale();
        }

        emit OrderCanceled(accountId, marketId, 0, commitmentTime);
        delete market.orders[accountId];
    }

    /// @inheritdoc IOrderModule
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

        uint64 commitmentTime = order.commitmentTime;
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

        // If `isAccountOwner` then 0 else charge cancellation fee.

        uint256 keeperFee;
        if (ERC2771Context._msgSender() != account.rbac.owner) {
            uint256 ethPrice = INodeModule(ORACLE_MANAGER)
                .process(globalConfig.ethOracleNodeId)
                .price
                .toUint();
            keeperFee = Order.getCancellationKeeperFee(ethPrice);
        }

        if (keeperFee > 0) {
            Margin.load(accountId, marketId).debtUsd += keeperFee.to128();
            market.totalTraderDebtUsd += keeperFee.to128();
            ISynthetixSystem(SYNTHETIX_CORE).withdrawMarketUsd(
                marketId,
                ERC2771Context._msgSender(),
                keeperFee
            );
        }

        emit OrderCanceled(accountId, marketId, keeperFee, commitmentTime);
        delete market.orders[accountId];
    }

    // --- Views --- //

    /// @inheritdoc IOrderModule
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

        uint64 commitmentTime = order.commitmentTime;
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

    /// @inheritdoc IOrderModule
    function getOrderFees(
        uint128 marketId,
        int128 sizeDelta,
        uint128 keeperFeeBufferUsd
    ) external view returns (uint256 orderFee, uint256 keeperFee) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        uint256 ethPrice = INodeModule(ORACLE_MANAGER)
            .process(globalConfig.ethOracleNodeId)
            .price
            .toUint();

        orderFee = Order.getOrderFee(
            sizeDelta,
            Order.getFillPrice(
                market.skew,
                marketConfig.skewScale,
                sizeDelta,
                market.getOraclePrice(
                    AddressRegistry.Data({
                        synthetix: ISynthetixSystem(SYNTHETIX_CORE),
                        sUsd: SYNTHETIX_SUSD,
                        oracleManager: ORACLE_MANAGER
                    })
                )
            ),
            market.skew,
            marketConfig.makerFee,
            marketConfig.takerFee
        );
        keeperFee = Order.getSettlementKeeperFee(keeperFeeBufferUsd, ethPrice);
    }

    /// @inheritdoc IOrderModule
    function getFillPrice(uint128 marketId, int128 size) external view returns (uint256) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return
            Order.getFillPrice(
                market.skew,
                PerpMarketConfiguration.load(marketId).skewScale,
                size,
                market.getOraclePrice(
                    AddressRegistry.Data({
                        synthetix: ISynthetixSystem(SYNTHETIX_CORE),
                        sUsd: SYNTHETIX_SUSD,
                        oracleManager: ORACLE_MANAGER
                    })
                )
            );
    }

    /// @inheritdoc IOrderModule
    function getOraclePrice(uint128 marketId) external view returns (uint256) {
        return
            PerpMarket.exists(marketId).getOraclePrice(
                AddressRegistry.Data({
                    synthetix: ISynthetixSystem(SYNTHETIX_CORE),
                    sUsd: SYNTHETIX_SUSD,
                    oracleManager: ORACLE_MANAGER
                })
            );
    }
}
