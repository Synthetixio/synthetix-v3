//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
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

        // A new order cannot be submitted if one is already pending.
        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound(accountId);
        }

        uint256 oraclePrice = market.getOraclePrice();
        recomputeFunding(market, oraclePrice);

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        //
        // NOTE: `fee` here does _not_ matter. We recompute the actual order fee on settlement. The same is true for
        // the keeper fee. These fees provide an approximation on remaining margin and hence infer whether the subsequent
        // order will reach liquidation or insufficient margin for the desired leverage.
        (, uint256 orderFee, uint256 keeperFee) = Position.validateTrade(
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
            Order.Data(accountId, sizeDelta, block.timestamp, limitPrice, keeperFeeBufferUsd)
        );
        emit OrderSubmitted(accountId, marketId, sizeDelta, block.timestamp, orderFee, keeperFee);
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
        PerpMarket.Data storage market,
        uint256 commitmentTime,
        uint256 publishTime,
        Position.TradeParams memory params
    ) private view {
        uint128 minOrderAge = globalConfig.minOrderAge;
        uint128 maxOrderAge = globalConfig.maxOrderAge;

        // The publishTime is _before_ the commitmentTime
        if (publishTime < commitmentTime) {
            revert ErrorUtil.StalePrice();
        }
        // Stale order can only be canceled.
        if (block.timestamp - commitmentTime > maxOrderAge) {
            revert ErrorUtil.StaleOrder();
        }
        // publishTime commitmentTime delta must be at least minAge.
        if (publishTime - commitmentTime < minOrderAge) {
            revert ErrorUtil.OrderNotReady();
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
            revert ErrorUtil.InvalidPrice();
        }
        if (ctptd > (commitmentTime.toInt() + maxOrderAge.toInt() + globalConfig.pythPublishTimeMax).toUint()) {
            revert ErrorUtil.InvalidPrice();
        }

        // Ensure pythPrice based fillPrice is within limitPrice.
        //
        // NOTE: When long then revert when `fillPrice < limitPrice`, when short then fillPrice < limitPrice`.
        if (
            (params.sizeDelta > 0 && params.fillPrice > params.limitPrice) ||
            (params.sizeDelta < 0 && params.fillPrice < params.limitPrice)
        ) {
            revert ErrorUtil.PriceToleranceExceeded(params.sizeDelta, params.fillPrice, params.limitPrice);
        }

        // Ensure pythPrice does not deviate too far from oracle price.
        //
        // NOTE: `params.oraclePrice` is the pythPrice on settlement.
        uint256 oraclePrice = market.getOraclePrice();
        uint256 priceDivergence = oraclePrice > params.oraclePrice
            ? oraclePrice / params.oraclePrice - DecimalMath.UNIT
            : params.oraclePrice / oraclePrice - DecimalMath.UNIT;
        if (priceDivergence > globalConfig.priceDivergencePercent) {
            revert ErrorUtil.PriceDivergenceTooHigh(oraclePrice, params.oraclePrice);
        }
    }

    /**
     * @dev Upon successful settlement, update `market` for `accountId` with `newPosition` details.
     */
    function updateMarketPostSettlement(
        uint128 accountId,
        PerpMarket.Data storage market,
        Position.Data memory newPosition,
        uint256 pythPrice
    ) private {
        Position.Data storage oldPosition = market.positions[accountId];

        // Update skew and market size upon successful settlement.
        market.skew += newPosition.size - oldPosition.size;
        market.size += (MathUtil.abs(newPosition.size).toInt() - MathUtil.abs(oldPosition.size).toInt())
            .toUint()
            .to128();

        // TODO: Think through this a bit. Will debt be updated if the newPosition is a fully closed position?
        market.updateDebtCorrection(accountId, oldPosition, newPosition, pythPrice);

        // Update collateral used for margin if necessary. We only perform this if modifying an existing position.
        if (oldPosition.size != 0) {
            int256 amountUsd = Margin.getMarginUsd(accountId, market, pythPrice).toInt() -
                Margin.getCollateralUsd(accountId, market.id).toInt();
            Margin.updateCollateralUsd(accountId, market, amountUsd);
        }

        if (newPosition.size == 0) {
            delete market.positions[accountId];
        } else {
            market.positions[accountId].update(newPosition);
        }

        // Wipe the order, successfully settled!
        delete market.orders[accountId];
    }

    /**
     * @inheritdoc IOrderModule
     */
    function settleOrder(uint128 accountId, uint128 marketId, bytes[] calldata priceUpdateData) external payable {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Order.Data storage order = market.orders[accountId];

        // No order available to settle.
        if (order.sizeDelta != 0) {
            revert ErrorUtil.OrderNotFound(accountId);
        }

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // TODO: This can be optimized as not all settlements may need the Pyth priceUpdateData.
        //
        // We can create a separate external updatePythPrice function, including adding an external `pythPrice`
        // such that keepers can conditionally update prices only if necessary.
        PerpMarket.updatePythPrice(priceUpdateData);
        (uint256 pythPrice, uint256 publishTime) = market.getPythPrice(order.commitmentTime);

        Position.TradeParams memory params = Position.TradeParams(
            order.sizeDelta,
            pythPrice,
            Order.getFillPrice(market.skew, marketConfig.skewScale, order.sizeDelta, pythPrice),
            marketConfig.makerFee,
            marketConfig.takerFee,
            order.limitPrice,
            order.keeperFeeBufferUsd
        );

        validateOrderPriceReadiness(globalConfig, market, order.commitmentTime, publishTime, params);

        recomputeFunding(market, pythPrice);

        // Validates whether this order would lead to a valid 'next' next position (plethora of revert errors).
        (Position.Data memory newPosition, uint256 orderFee, uint256 keeperFee) = Position.validateTrade(
            accountId,
            market,
            params
        );

        updateMarketPostSettlement(accountId, market, newPosition, pythPrice);

        globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, keeperFee);

        emit OrderSettled(accountId, marketId, order.sizeDelta, orderFee, keeperFee);
    }

    /**
     * @inheritdoc IOrderModule
     */
    function cancelOrder(uint128 accountId, uint128 marketId) external {
        // TODO: Consider removing cancellations. Do we need it?
        //
        // If an order is stale, on next settle, we can simply wipe the order, emit event, start new order.
    }

    /**
     * @inheritdoc IOrderModule
     */
    function simulateOrder(
        uint128 accountId,
        uint128 marketId,
        uint128 sizeDelta,
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
    function getFillPrice(uint128 marketId, int128 sizeDelta) external view returns (uint256 price) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        price = Order.getFillPrice(market.skew, marketConfig.skewScale, sizeDelta, market.getOraclePrice());
    }

    /**
     * @inheritdoc IOrderModule
     */
    function getOraclePrice(uint128 marketId) external view returns (uint256 price) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        price = market.getOraclePrice();
    }
}
