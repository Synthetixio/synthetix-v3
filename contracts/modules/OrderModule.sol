//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        // A new order cannot be submitted if one is already pending.
        if (order.sizeDelta != 0) {
            revert Error.OrderAlreadyExists(accountId);
        }

        Position.Data storage position = market.positions[accountId];

        uint256 oraclePrice = market.assetPrice();

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

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        Position.postTradeDetails(marketId, position, params);

        // Using keeper fee and order fees, deduct from their collateral value and then determine whether this position is "good"
        // look at the current position's remaining margin p.collateral.map(c => c.amount * c.price), include their pnl and funding accrued
        // also, consider the fees incurred on this settlement (keeper and order fees) to determine if this position, had it been executed,
        // would correctly be in a bad place (i.e instant liquidation)

        // TODO: Check if this new position can be insta liquidated (this might already be done in postTradeDetails)

        // TODO: Create an order object if successful (minExecutedTime etc.)

        // TODO: Store order object

        // TODO: Emit an event to signal such order has been submitted.

        // TODO: Critical we ensure that removing keeper fee on commitment will not insta liquidate the user.
    }

    /**
     * @inheritdoc IOrderModule
     */
    function settledOrder(uint128 accountId, uint128 marketId) external payable {}

    /**
     * @inheritdoc IOrderModule
     */
    function cancelOrder(uint128 accountId, uint128 marketId) external {}

    /**
     * @inheritdoc IOrderModule
     */
    function orderFee(uint128 marketId, int128 sizeDelta) external view returns (uint256 fee) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        uint256 oraclePrice = market.assetPrice();
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
    function fillPrice(uint128 marketId, int128 sizeDelta, uint256 oraclePrice) external view returns (uint256 price) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        price = Order.fillPrice(market.skew, market.skewScale, sizeDelta, oraclePrice);
    }
}
