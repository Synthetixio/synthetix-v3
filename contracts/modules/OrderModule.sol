//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpErrors} from "../storage/PerpErrors.sol";
import {Order} from "../storage/Order.sol";
import {Position} from "../storage/Position.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
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

    /**
     * @inheritdoc IOrderModule
     */
    function commitOrder(uint128 accountId, uint128 marketId, int128 sizeDelta, uint256 limitPrice) external {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        // A new order cannot be submitted if one is already pending.
        if (order.sizeDelta != 0) {
            revert PerpErrors.OrderFound(accountId);
        }

        Position.Data storage position = market.positions[accountId];

        uint256 oraclePrice = market.oraclePrice();

        Position.TradeParams memory params = Position.TradeParams({
            sizeDelta: sizeDelta,
            oraclePrice: oraclePrice,
            fillPrice: Order.fillPrice(market.skew, market.skewScale, sizeDelta, oraclePrice),
            makerFee: market.makerFee,
            takerFee: market.takerFee,
            limitPrice: limitPrice
        });

        // Compute next funding entry/rate
        market.recomputeFunding(oraclePrice);

        // TODO: Emit the FundingRecomputed event
        //
        // FundingRecomputed will be an event that's shared throughout so it may be worth defining this in a single location.

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        //
        // NOTE: `fee` here does _not_ matter. We recompute the actual order fee on settlement. The same is true for
        // the keeper fee. These fees provide an approximation on remaining margin and hence infer whether the subsequent
        // order will reach liquidation or insufficient margin for the desired leverage.
        (, uint256 orderfee, uint256 keeperFee) = Position.postTradeDetails(accountId, marketId, position, params);

        Order.Data memory newOrder = Order.Data({
            accountId: accountId,
            sizeDelta: sizeDelta,
            commitmentTime: block.timestamp,
            limitPrice: limitPrice
        });

        order.update(newOrder);

        emit OrderSubmitted(accountId, marketId, sizeDelta, newOrder.commitmentTime, keeperFee, orderfee);
    }

    /**
     * @inheritdoc IOrderModule
     */
    function settledOrder(uint128 accountId, uint128 marketId, bytes[] calldata priceUpdateData) external payable {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        // No order available to settle.
        if (order.sizeDelta != 0) {
            revert PerpErrors.OrderNotFound(accountId);
        }

        uint256 commitmentTime = order.commitmentTime;

        // TODO: This can be optimised as not all settlements may need the Pyth priceUpdateData.
        market.updatePythPrice(priceUpdateData);
        (uint256 pythPrice, uint256 publishTime) = market.pythPrice(commitmentTime);

        // The publishTime is _before_ the commitmentTime
        if (publishTime < commitmentTime) {
            revert PerpErrors.StalePrice();
        }
        // Stale order can only be cancelled.
        if (block.timestamp - commitmentTime > market.maxOrderAge) {
            revert PerpErrors.StaleOrder();
        }
        // publishTime commitmentTime delta must be at least minAge.
        if (publishTime - commitmentTime < market.minOrderAge) {
            revert PerpErrors.OrderNotReady();
        }
        // publishTime must be within `ct + minAge + ptm <= pt <= ct + maxAge + ptm'`
        //
        // ct     = commitmentTime
        // pt     = publishTime
        // minAge = minimum time passed (not ready)
        // maxAge = maximum time passed (stale)
        // ptm    = publishTimeMin
        // ptm'   = publishTimeMax
        uint256 ctptd = publishTime - commitmentTime; // ctptd is commitmentTimePublishTimeDelta
        if (ctptd < (commitmentTime.toInt() + market.minOrderAge.toInt() + market.pythPublishTimeMin).toUint()) {
            revert PerpErrors.InvalidPrice();
        }
        if (ctptd > (commitmentTime.toInt() + market.maxOrderAge.toInt() + market.pythPublishTimeMax).toUint()) {
            revert PerpErrors.InvalidPrice();
        }

        Position.Data storage position = market.positions[accountId];

        Position.TradeParams memory params = Position.TradeParams({
            sizeDelta: order.sizeDelta,
            oraclePrice: pythPrice,
            fillPrice: Order.fillPrice(market.skew, market.skewScale, order.sizeDelta, pythPrice),
            makerFee: market.makerFee,
            takerFee: market.takerFee,
            limitPrice: order.limitPrice
        });

        // Compute next funding entry/rate
        market.recomputeFunding(pythPrice);

        // TODO: Verify the deviation between pythPrice and oraclePrice.

        // TODO: Emit the FundingRecomputed event
        //
        // FundingRecomputed will be an event that's shared throughout so it may be worth defining this in a single location.

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        //
        // NOTE: `fee` here does _not_ matter. We recompute the actual order fee on settlement. The same is true for
        // the keeper fee. These fees provide an approximation on remaining margin and hence infer whether the subsequent
        // order will reach liquidation or insufficient margin for the desired leverage.
        (Position.Data memory newPosition, , ) = Position.postTradeDetails(accountId, marketId, position, params);

        position.update(newPosition);
        order.clear();

        // TODO: Emit events
    }

    /**
     * @inheritdoc IOrderModule
     */
    function cancelOrder(uint128 accountId, uint128 marketId) external {}

    /**
     * @inheritdoc IOrderModule
     */
    function orderFee(uint128 marketId, int128 sizeDelta) external view returns (uint256 fee) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        uint256 oraclePrice = market.oraclePrice();
        int128 skew = market.skew;
        uint128 skewScale = market.skewScale;

        fee = Order.orderFee(
            sizeDelta,
            Order.fillPrice(skew, skewScale, sizeDelta, oraclePrice),
            skew,
            market.makerFee,
            market.takerFee
        );
    }

    /**
     * @inheritdoc IOrderModule
     */
    function orderKeeperFee(uint256 keeperFeeBufferUsd) external view returns (uint256 fee) {}

    /**
     * @inheritdoc IOrderModule
     */
    function fillPrice(uint128 marketId, int128 sizeDelta, uint256 oraclePrice) external view returns (uint256 price) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        price = Order.fillPrice(market.skew, market.skewScale, sizeDelta, oraclePrice);
    }
}
