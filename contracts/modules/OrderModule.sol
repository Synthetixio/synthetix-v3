//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {Error} from "../storage/Error.sol";
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
            revert Error.OrderAlreadyExists(accountId);
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
    function settledOrder(uint128 accountId, uint128 marketId, bytes[] calldata vaa) external payable {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        // No order available to settle.
        if (order.sizeDelta != 0) {
            revert Error.OrderNotFound(accountId);
        }

        // Get this time from the vaa publishTime.
        uint256 publishTime = 0;
        uint256 commitmentTime = order.commitmentTime;

        /*
            // Old publish times before commitment should be thrown out.
            if (publishTime < commitmentTime) {
                revert Error.StalePrice();
            }

            // Throw out stale orders, they can only be cancelled.
            if (block.timestamp - commitmentTime > market.maxOrderAge) {
                revert Error.StaleOrder();
            }

            // Check that the publishTime is
            if (publishTime - commitmentTime < market.minOrderAge) {
                revert Error.OrderSettlementNotReady();
            }

            // Check the publishTime is within an acceptable range.
            //
            // Time difference (in seconds) between the publishTime and commitmentTime (above check ensures this is always
            // positive). Essentially, how much time has passed since this order was committed. It must be within a range,
            // where it's defined as `t - 4 > d < t - 2`.
            uint256 delta = publishTime - commitmentTime;

        */

        // Check that the order can be executed (old enough but not too old).

        // // Check the publishTime is older than

        // require((executionTimestamp > order.intentionTime), "price not updated");
        // require((executionTimestamp - order.intentionTime > minAge), "executability not reached");
        // require((block.timestamp - order.intentionTime < maxAge), "order too old, use cancel");

        // Ensure said order is in a state which it can be executed (postTradeDetails)
        // Validate the provided VAA from WH sent through from Pyth
        // Validate the publishTimes
        // Derive fees, infer fillPrice etc.
        // Insert collateral into Synthetix Core to track
        // Remove order
        // Modify position
        // Emit events
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
