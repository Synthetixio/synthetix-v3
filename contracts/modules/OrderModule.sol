//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../interfaces/IOrderModule.sol";
import {Order} from "../storage/Order.sol";
import {Position} from "../storage/Position.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";

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
    function commitOrder(uint128 accountId, uint128 marketId, int128 sizeDelta, uint256 desiredFillPrice) external {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        // A new order cannot be submitted if one is already pending.
        if (order.sizeDelta != 0) {
            revert PendingOrderFound();
        }

        Position.Data storage position = market.positions[accountId];

        uint256 oraclePrice = PerpMarket.assetPrice(marketId);

        Position.TradeParams memory params = Position.TradeParams({
            sizeDelta: sizeDelta,
            oraclePrice: oraclePrice,
            fillPrice: _fillPrice(market.skew, market.skewScale, sizeDelta, oraclePrice),
            makerFee: market.makerFee,
            takerFee: market.takerFee,
            desiredFillPrice: desiredFillPrice
        });

        // Validate whether this order would lead to a valid 'next' next position.
        Position.postTradeDetails(position, params);

        // TODO: Check if this new position can be insta liquidated (this might already be done in postTradeDetails)

        // TODO: Create an order object if successful (minExecutedTime etc.)

        // TODO: Store order object

        // TODO: Emit an event to signal such order has been submitted.
    }

    /**
     * @inheritdoc IOrderModule
     */
    function settledOrder(uint128 accountId, uint128 marketId) external {}

    /**
     * @inheritdoc IOrderModule
     */
    function cancelOrder(uint128 accountId, uint128 marketId) external {}

    /**
     * @inheritdoc IOrderModule
     */
    function orderFee(int128 sizeDelta) external view returns (uint256 fee) {}

    /**
     * @inheritdoc IOrderModule
     */
    function fillPrice(uint128 marketId, int128 sizeDelta, uint256 oraclePrice) external view returns (uint256 price) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        price = _fillPrice(market.skew, market.skewScale, sizeDelta, oraclePrice);
    }

    // --- Internal --- //

    function _fillPrice(
        int128 skew,
        uint128 skewScale,
        int128 sizeDelta,
        uint256 oraclePrice
    ) internal pure returns (uint256) {
        // How is the p/d-adjusted price calculated using an example:
        //
        // price      = $1200 USD (oracle)
        // size       = 100
        // skew       = 0
        // skew_scale = 1,000,000 (1M)
        //
        // Then,
        //
        // pd_before = 0 / 1,000,000
        //           = 0
        // pd_after  = (0 + 100) / 1,000,000
        //           = 100 / 1,000,000
        //           = 0.0001
        //
        // price_before = 1200 * (1 + pd_before)
        //              = 1200 * (1 + 0)
        //              = 1200
        // price_after  = 1200 * (1 + pd_after)
        //              = 1200 * (1 + 0.0001)
        //              = 1200 * (1.0001)
        //              = 1200.12
        // Finally,
        //
        // fill_price = (price_before + price_after) / 2
        //            = (1200 + 1200.12) / 2
        //            = 1200.06
        int256 pdBefore = skew.divDecimal(skewScale.toInt());
        int256 pdAfter = (skew + sizeDelta).divDecimal(skewScale.toInt());
        int256 priceBefore = oraclePrice.toInt() + (oraclePrice.toInt().mulDecimal(pdBefore));
        int256 priceAfter = oraclePrice.toInt() + (oraclePrice.toInt().mulDecimal(pdAfter));
        return (priceBefore + priceAfter).toUint().divDecimal(DecimalMath.UNIT * 2);
    }
}
