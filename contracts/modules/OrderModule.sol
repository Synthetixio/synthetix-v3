//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {Order} from "../storage/Order.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import "../interfaces/IOrderModule.sol";

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

    /** @dev Same implementation as `MarginModule.validateOrderAvailability`. */
    function validateOrderAvailability(
        uint128 accountId,
        uint128 marketId,
        PerpMarket.Data storage market,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) private {
        Order.Data storage order = market.orders[accountId];

        // A new order cannot be submitted if one is already pending.
        if (order.sizeDelta != 0) {
            // Check if this order can be cancelled. If so, cancel and then proceed.
            if (block.timestamp > order.commitmentTime + globalConfig.maxOrderAge) {
                delete market.orders[accountId];
                emit OrderCanceled(accountId, marketId, order.commitmentTime);
            } else {
                revert ErrorUtil.OrderFound();
            }
        }
    }

    /**
     * @inheritdoc IOrderModule
     */
    function commitOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint256 keeperFeeBufferUsd
    ) external {
        Account.exists(accountId);
        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION);

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        validateOrderAvailability(accountId, marketId, market, globalConfig);
        uint256 oraclePrice = market.getOraclePrice();

        // TODO: Consider removing and only recomputing funding at the settlement.
        recomputeFunding(market, oraclePrice);

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

        market.orders[accountId].update(Order.Data(sizeDelta, block.timestamp, limitPrice, keeperFeeBufferUsd));
        emit OrderSubmitted(accountId, marketId, sizeDelta, block.timestamp, trade.orderFee, trade.keeperFee);
    }

    /**
     * @dev Generic helper for funding recomputation during order management.
     */
    function recomputeFunding(PerpMarket.Data storage market, uint256 price) private {
        (int256 fundingRate, ) = market.recomputeFunding(price);
        emit FundingRecomputed(market.id, market.skew, fundingRate, market.getCurrentFundingVelocity());
    }

    /**
     * @dev Validates that an order can only be settled iff time and price is acceptable.
     */
    function validateOrderPriceReadiness(
        PerpMarketConfiguration.GlobalData storage globalConfig,
        uint256 commitmentTime,
        uint256 publishTime,
        Position.TradeParams memory params
    ) private view {
        // The publishTime is _before_ the commitmentTime
        if (publishTime < commitmentTime) {
            revert ErrorUtil.StalePrice();
        }
        // A stale order is one where time passed is max age or older (>=).
        if (block.timestamp - commitmentTime >= globalConfig.maxOrderAge) {
            revert ErrorUtil.StaleOrder();
        }
        // Amount of time that has passed must be at least the minimum order age (>=).
        if (block.timestamp - commitmentTime < globalConfig.minOrderAge) {
            revert ErrorUtil.OrderNotReady();
        }

        // Time delta must be within pythPublishTimeMin and pythPublishTimeMax.
        //
        // If `minOrderAge` is 12s then publishTime must be between 8 and 12 (inclusive). When inferring
        // this parameter off-chain and prior to configuration, it must look at `minOrderAge` to a relative value.
        uint256 publishCommitmentTimeDelta = publishTime - commitmentTime;
        if (
            publishCommitmentTimeDelta < globalConfig.pythPublishTimeMin ||
            publishCommitmentTimeDelta > globalConfig.pythPublishTimeMax
        ) {
            revert ErrorUtil.InvalidPrice();
        }

        // Ensure pythPrice based fillPrice does not exceed limitPrice on the fill.
        //
        // NOTE: When long then revert when `fillPrice > limitPrice`, when short then fillPrice < limitPrice`.
        if (
            (params.sizeDelta > 0 && params.fillPrice > params.limitPrice) ||
            (params.sizeDelta < 0 && params.fillPrice < params.limitPrice)
        ) {
            revert ErrorUtil.PriceToleranceExceeded(params.sizeDelta, params.fillPrice, params.limitPrice);
        }
    }

    /**
     * @dev Upon successful settlement, update `market` for `accountId` with `newPosition` details.
     */
    function updateMarketPostSettlement(
        uint128 accountId,
        PerpMarket.Data storage market,
        Position.Data memory newPosition,
        uint256 collateralUsd,
        uint256 newMarginUsd
    ) private {
        Position.Data storage oldPosition = market.positions[accountId];

        market.skew = market.skew + newPosition.size - oldPosition.size;
        market.size = (market.size.to256() + MathUtil.abs(newPosition.size) - MathUtil.abs(oldPosition.size)).to128();

        market.updateDebtCorrection(oldPosition, newPosition, collateralUsd, newMarginUsd);

        // Update collateral used for margin if necessary. We only perform this if modifying an existing position.
        if (oldPosition.size != 0) {
            Margin.updateAccountCollateral(accountId, market, newMarginUsd.toInt() - collateralUsd.toInt());
        }

        if (newPosition.size == 0) {
            delete market.positions[accountId];
        } else {
            market.positions[accountId].update(newPosition);
        }

        // Wipe the order, successfully settled!
        delete market.orders[accountId];
    }

    struct Runtime_settleOrder {
        uint256 pythPrice;
        uint256 publishTime;
        int256 accruedFunding;
        int256 pnl;
        uint256 fillPrice;
        Position.ValidatedTrade trade;
        Position.TradeParams params;
    }

    /**
     * @inheritdoc IOrderModule
     */
    function settleOrder(uint128 accountId, uint128 marketId, bytes[] calldata priceUpdateData) external payable {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];
        Runtime_settleOrder memory runtime;

        // No order available to settle.
        if (order.sizeDelta == 0) {
            revert ErrorUtil.OrderNotFound();
        }

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // TODO: This can be optimized as not all settlements may need the Pyth priceUpdateData.
        //
        // We can create a separate external updatePythPrice function, including adding an external `pythPrice`
        // such that keepers can conditionally update prices only if necessary.
        PerpMarket.updatePythPrice(priceUpdateData);
        (runtime.pythPrice, runtime.publishTime) = market.getPythPrice(order.commitmentTime);
        runtime.fillPrice = Order.getFillPrice(market.skew, marketConfig.skewScale, order.sizeDelta, runtime.pythPrice);
        runtime.params = Position.TradeParams(
            order.sizeDelta,
            runtime.pythPrice,
            runtime.fillPrice,
            marketConfig.makerFee,
            marketConfig.takerFee,
            order.limitPrice,
            order.keeperFeeBufferUsd
        );

        validateOrderPriceReadiness(globalConfig, order.commitmentTime, runtime.publishTime, runtime.params);

        recomputeFunding(market, runtime.pythPrice);

        runtime.trade = Position.validateTrade(accountId, market, runtime.params);

        (, runtime.accruedFunding, runtime.pnl, ) = market.positions[accountId].getHealthData(
            market,
            runtime.trade.newMarginUsd,
            runtime.pythPrice,
            marketConfig
        );
        updateMarketPostSettlement(
            accountId,
            market,
            runtime.trade.newPosition,
            // @dev note that we're using getCollateralUsd and not marginUsd as we dont want price changes to be deducted yet.
            Margin.getCollateralUsd(accountId, marketId),
            runtime.trade.newMarginUsd
        );

        globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, runtime.trade.keeperFee);
        emit OrderSettled(
            accountId,
            marketId,
            runtime.params.sizeDelta,
            runtime.trade.orderFee,
            runtime.trade.keeperFee,
            runtime.accruedFunding,
            runtime.pnl,
            runtime.fillPrice,
            block.timestamp
        );
    }

    /**
     * @inheritdoc IOrderModule
     */
    function getOrderDigest(uint128 accountId, uint128 marketId) external view returns (Order.Data memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return market.orders[accountId];
    }

    /**
     * @inheritdoc IOrderModule
     */
    function simulateOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint256 keeperFeeBufferUsd,
        uint256 oraclePrice
    ) external view {
        // TODO: Implement me
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
            Order.getFillPrice(market.skew, marketConfig.skewScale, sizeDelta, market.getOraclePrice()),
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
