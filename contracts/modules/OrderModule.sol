//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpErrors} from "../storage/PerpErrors.sol";
import {Order} from "../storage/Order.sol";
import {Position} from "../storage/Position.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
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
    function commitOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint256 keeperFeeBufferUsd
    ) external {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        // A new order cannot be submitted if one is already pending.
        if (order.sizeDelta != 0) {
            revert PerpErrors.OrderFound(accountId);
        }

        uint256 oraclePrice = market.oraclePrice();

        (int256 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.currentFundingVelocity());

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        Position.TradeParams memory params = Position.TradeParams({
            sizeDelta: sizeDelta,
            oraclePrice: oraclePrice,
            fillPrice: Order.fillPrice(market.skew, marketConfig.skewScale, sizeDelta, oraclePrice),
            makerFee: marketConfig.makerFee,
            takerFee: marketConfig.takerFee,
            limitPrice: limitPrice,
            keeperFeeBufferUsd: keeperFeeBufferUsd
        });

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        //
        // NOTE: `fee` here does _not_ matter. We recompute the actual order fee on settlement. The same is true for
        // the keeper fee. These fees provide an approximation on remaining margin and hence infer whether the subsequent
        // order will reach liquidation or insufficient margin for the desired leverage.
        (, uint256 _orderFee, uint256 keeperFee) = Position.validateTrade(accountId, marketId, params);

        market.updateOrder(
            Order.Data({
                accountId: accountId,
                sizeDelta: sizeDelta,
                commitmentTime: block.timestamp,
                limitPrice: limitPrice,
                keeperFeeBufferUsd: keeperFeeBufferUsd
            })
        );

        emit OrderSubmitted(accountId, marketId, sizeDelta, block.timestamp, _orderFee, keeperFee);
    }

    /**
     * @dev Ensures the order can only be settled iff time and price is acceptable.
     */
    function validateOrderPriceReadiness(
        PerpMarketConfiguration.GlobalData storage globalConfig,
        PerpMarket.Data storage market,
        uint256 commitmentTime,
        uint256 publishTime,
        uint256 pythPrice
    ) internal view {
        uint128 minOrderAge = globalConfig.minOrderAge;
        uint128 maxOrderAge = globalConfig.maxOrderAge;

        // The publishTime is _before_ the commitmentTime
        if (publishTime < commitmentTime) {
            revert PerpErrors.StalePrice();
        }
        // Stale order can only be canceled.
        if (block.timestamp - commitmentTime > maxOrderAge) {
            revert PerpErrors.StaleOrder();
        }
        // publishTime commitmentTime delta must be at least minAge.
        if (publishTime - commitmentTime < minOrderAge) {
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
        if (ctptd < (commitmentTime.toInt() + minOrderAge.toInt() + globalConfig.pythPublishTimeMin).toUint()) {
            revert PerpErrors.InvalidPrice();
        }
        if (ctptd > (commitmentTime.toInt() + maxOrderAge.toInt() + globalConfig.pythPublishTimeMax).toUint()) {
            revert PerpErrors.InvalidPrice();
        }

        // Ensure pythPrice does not deviate too far from oracle price.
        uint256 oraclePrice = market.oraclePrice();
        uint256 priceDivergence = oraclePrice > pythPrice
            ? oraclePrice / pythPrice - DecimalMath.UNIT
            : pythPrice / oraclePrice - DecimalMath.UNIT;
        if (priceDivergence > globalConfig.priceDivergenceRatio) {
            revert PerpErrors.PriceDivergenceTooHigh(oraclePrice, pythPrice);
        }
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

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // TODO: This can be optimized as not all settlements may need the Pyth priceUpdateData.
        //
        // We can create a separate external updatePythPrice function, including adding an external `pythPrice`
        // such that keepers can conditionally update prices only if necessary.
        market.updatePythPrice(priceUpdateData);
        (uint256 pythPrice, uint256 publishTime) = market.pythPrice(order.commitmentTime);

        validateOrderPriceReadiness(globalConfig, market, order.commitmentTime, publishTime, pythPrice);

        Position.TradeParams memory params = Position.TradeParams({
            sizeDelta: order.sizeDelta,
            oraclePrice: pythPrice,
            fillPrice: Order.fillPrice(market.skew, marketConfig.skewScale, order.sizeDelta, pythPrice),
            makerFee: marketConfig.makerFee,
            takerFee: marketConfig.takerFee,
            limitPrice: order.limitPrice,
            keeperFeeBufferUsd: order.keeperFeeBufferUsd
        });

        (int256 fundingRate, ) = market.recomputeFunding(pythPrice);
        emit FundingRecomputed(marketId, market.skew, fundingRate, market.currentFundingVelocity());

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        (Position.Data memory newPosition, uint256 _orderFee, uint256 keeperFee) = Position.validateTrade(
            accountId,
            marketId,
            params
        );

        // TODO: Condition to position.clear() when completely closing position?
        market.updatePosition(newPosition);
        order.clear();

        emit OrderSettled(accountId, marketId, order.sizeDelta, _orderFee, keeperFee);
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
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        int128 skew = market.skew;
        fee = Order.orderFee(
            sizeDelta,
            Order.fillPrice(skew, marketConfig.skewScale, sizeDelta, market.oraclePrice()),
            skew,
            marketConfig.makerFee,
            marketConfig.takerFee
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
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        price = Order.fillPrice(market.skew, marketConfig.skewScale, sizeDelta, oraclePrice);
    }
}
