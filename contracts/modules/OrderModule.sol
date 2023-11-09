//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {IOrderModule} from "../interfaces/IOrderModule.sol";
import {Margin} from "../storage/Margin.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Order} from "../storage/Order.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {SafeCastI128, SafeCastI256, SafeCastU128, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

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

    // --- Runtime structs --- //

    struct Runtime_settleOrder {
        uint256 pythPrice;
        uint256 publishTime;
        int256 accruedFunding;
        int256 pnl;
        uint256 fillPrice;
        Position.ValidatedTrade trade;
        Position.TradeParams params;
    }

    // --- Helpers --- //
    function isPriceToleranceExceeded(
        int128 sizeDelta,
        uint256 fillPrice,
        uint256 limitPrice
    ) private pure returns (bool) {
        // Ensure pythPrice based fillPrice does not exceed limitPrice on the fill.
        //
        // NOTE: When long then revert when `fillPrice > limitPrice`, when short then fillPrice < limitPrice`.
        return (sizeDelta > 0 && fillPrice > limitPrice) || (sizeDelta < 0 && fillPrice < limitPrice);
    }

    function isOrderStale(uint256 commitmentTime, uint256 maxOrderAge) private view returns (bool) {
        // A stale order is one where time passed is max age or older (>=).
        return block.timestamp - commitmentTime >= maxOrderAge;
    }

    function isOrderReady(uint256 commitmentTime, uint256 minOrderAge) private view returns (bool) {
        // Amount of time that has passed must be at least the minimum order age (>=).
        return block.timestamp - commitmentTime >= minOrderAge;
    }

    function isPriceDivergenceExceeded(
        uint256 onchainPrice,
        uint256 oraclePrice,
        uint256 priceDivergencePercent
    ) private view returns (bool) {
        // Ensure Pyth price does not diverge too far from on-chain price from CL.
        //
        // e.g. A maximum of 3% price divergence with the following prices:
        //
        // (1800, 1700) ~ 5.882353% divergence => PriceDivergenceExceeded
        // (1800, 1750) ~ 2.857143% divergence => Ok
        // (1854, 1800) ~ 3%        divergence => Ok
        // (1855, 1800) ~ 3.055556% divergence => PriceDivergenceExceeded
        uint256 priceDelta = onchainPrice > oraclePrice
            ? onchainPrice.divDecimal(oraclePrice) - DecimalMath.UNIT
            : oraclePrice.divDecimal(onchainPrice) - DecimalMath.UNIT;

        return priceDelta > priceDivergencePercent;
    }

    /**
     * @dev Validates that an order can only be settled iff time and price is acceptable.
     */
    function validateOrderPriceReadiness(
        PerpMarket.Data storage market,
        PerpMarketConfiguration.GlobalData storage globalConfig,
        uint256 commitmentTime,
        uint256 publishTime,
        Position.TradeParams memory params
    ) private view {
        // The publishTime is _before_ the commitmentTime
        if (publishTime < commitmentTime) {
            revert ErrorUtil.StalePrice();
        }

        if (isOrderStale(commitmentTime, globalConfig.maxOrderAge)) {
            revert ErrorUtil.StaleOrder();
        }
        if (!isOrderReady(commitmentTime, globalConfig.minOrderAge)) {
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

        uint256 onchainPrice = market.getOraclePrice();

        // Do not accept zero prices.
        if (onchainPrice == 0 || params.oraclePrice == 0) {
            revert ErrorUtil.InvalidPrice();
        }
        if (isPriceToleranceExceeded(params.sizeDelta, params.fillPrice, params.limitPrice)) {
            revert ErrorUtil.PriceToleranceExceeded(params.sizeDelta, params.fillPrice, params.limitPrice);
        }

        if (isPriceDivergenceExceeded(onchainPrice, params.oraclePrice, globalConfig.priceDivergencePercent)) {
            revert ErrorUtil.PriceDivergenceExceeded(params.oraclePrice, onchainPrice);
        }
    }

    /**
     * @dev Generic helper for funding recomputation during order management.
     */
    function recomputeFunding(PerpMarket.Data storage market, uint256 price) private {
        (int256 fundingRate, ) = market.recomputeFunding(price);
        emit FundingRecomputed(market.id, market.skew, fundingRate, market.getCurrentFundingVelocity());
    }

    /**
     * @dev Upon successful settlement, update `market` and account margin with `newPosition` details.
     */
    function stateUpdatePostSettlement(
        uint128 accountId,
        PerpMarket.Data storage market,
        Position.Data memory newPosition,
        uint256 collateralUsd,
        uint256 newMarginUsd
    ) private {
        Position.Data storage oldPosition = market.positions[accountId];

        market.skew = market.skew + newPosition.size - oldPosition.size;
        market.size = (market.size.to256() + MathUtil.abs(newPosition.size) - MathUtil.abs(oldPosition.size)).to128();

        market.updateDebtCorrection(oldPosition, newPosition);

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

    // --- Mutative --- //

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
        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION);

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

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

        market.orders[accountId].update(Order.Data(sizeDelta, block.timestamp, limitPrice, keeperFeeBufferUsd));
        emit OrderCommitted(accountId, marketId, block.timestamp, sizeDelta, trade.orderFee, trade.keeperFee);
    }

    /**
     * @inheritdoc IOrderModule
     */
    function settleOrder(uint128 accountId, uint128 marketId, bytes[] calldata priceUpdateData) external payable {
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

        validateOrderPriceReadiness(market, globalConfig, order.commitmentTime, runtime.publishTime, runtime.params);

        recomputeFunding(market, runtime.pythPrice);

        runtime.trade = Position.validateTrade(accountId, market, runtime.params);

        (, runtime.accruedFunding, runtime.pnl, ) = market.positions[accountId].getHealthData(
            market,
            runtime.trade.newMarginUsd,
            runtime.pythPrice,
            marketConfig
        );
        stateUpdatePostSettlement(
            accountId,
            market,
            runtime.trade.newPosition,
            // @dev We're using getCollateralUsd and not marginUsd as we dont want price changes to be deducted yet.
            Margin.getCollateralUsd(accountId, marketId),
            // @dev This is (oldMargin - orderFee - keeperFee). Where oldMargin has pnl, accruedFunding and prev fees taken into account.
            runtime.trade.newMarginUsd
        );

        // If maxKeeperFee configured to zero then we want to rpevent withdraws of 0.
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
            runtime.accruedFunding,
            runtime.pnl,
            runtime.fillPrice
        );
    }
    function cancelOrder(uint128 accountId, uint128 marketId, bytes calldata priceUpdateData) external payable {
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

        // If order is stale allow cancelation from owner regardless of price.
        if (isOrderStale(order.commitmentTime, globalConfig.maxOrderAge)) {
            // Only allow owner to clear stale orders
            if (!isAccountOwner) {
                revert ErrorUtil.StaleOrder();
            }
        } else {
            // Order is ready and not stale, check if price tolerance is exceeded
            uint256 pythPrice = PythUtil.parsePythPrice(
                globalConfig,
                marketConfig,
                order.commitmentTime,
                priceUpdateData
            );
            uint256 fillPrice = Order.getFillPrice(market.skew, marketConfig.skewScale, order.sizeDelta, pythPrice);
            uint256 onchainPrice = market.getOraclePrice();

            if (isPriceDivergenceExceeded(onchainPrice, pythPrice, globalConfig.priceDivergencePercent)) {
                revert ErrorUtil.PriceDivergenceExceeded(pythPrice, onchainPrice);
            }

            if (!isPriceToleranceExceeded(order.sizeDelta, fillPrice, order.limitPrice)) {
                revert ErrorUtil.PriceToleranceNotExceeded(order.sizeDelta, fillPrice, order.limitPrice);
            }
        }

        uint256 keeperFee = isAccountOwner ? 0 : Order.getSettlementKeeperFee(order.keeperFeeBufferUsd);
        if (keeperFee > 0) {
            Margin.updateAccountCollateral(accountId, market, keeperFee.toInt() * -1);
            globalConfig.synthetix.withdrawMarketUsd(marketId, msg.sender, keeperFee);
        }
        uint256 commitmentTime = order.commitmentTime;
        delete market.orders[accountId];

        emit OrderCanceled(accountId, marketId, commitmentTime);
    }

    /**
     * @inheritdoc IOrderModule
     */
    function getOrderDigest(uint128 accountId, uint128 marketId) external view returns (Order.Data memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return market.orders[accountId];
    }

    // --- Views --- //

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
