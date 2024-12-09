//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {IBookOrderModule} from "../interfaces/IBookOrderModule.sol";
import {IAccountEvents} from "../interfaces/IAccountEvents.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {MarketUpdate} from "../storage/MarketUpdate.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {Flags} from "../utils/Flags.sol";

/**
 * @title Module for processing orders from an off-chain orderbook.
 * @dev See IBookOrderModule.
 */
contract BookOrderModule is IBookOrderModule, IAccountEvents, IMarketEvents {
    using AsyncOrder for AsyncOrder.Data;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarket for PerpsMarket.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;

    /**
     * @notice Gets fired when a new order is settled.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param fillPrice Price at which the order was settled.
     * @param pnl Pnl of the previous closed position.
     * @param accruedFunding Accrued funding of the previous closed position.
     * @param sizeDelta Size delta from order.
     * @param newSize New size of the position after settlement.
     * @param totalFees Amount of fees collected by the protocol.
     * @param referralFees Amount of fees collected by the referrer.
     * @param collectedFees Amount of fees collected by fee collector.
     * @param settlementReward reward to sender for settling order.
     * @param trackingCode Optional code for integrator tracking purposes.
     * @param settler address of the settler of the order.
     */
    event OrderSettled(
        uint128 indexed marketId,
        uint128 indexed accountId,
        uint256 fillPrice,
        int256 pnl,
        int256 accruedFunding,
        int128 sizeDelta,
        int128 newSize,
        uint256 totalFees,
        uint256 referralFees,
        uint256 collectedFees,
        uint256 settlementReward,
        bytes32 indexed trackingCode,
        address settler
    );

    /**
     * @notice Gets fired after order settles and includes the interest charged to the account.
     * @param accountId Id of the account used for the trade.
     * @param interest interest charges
     */
    event InterestCharged(uint128 indexed accountId, uint256 interest);

    struct AccumulatedOrderData {
        uint256 orderFee;
        int256 sizeDelta;
        uint256 orderCount;
        uint256 price;
    }

    event DoneLoop(uint128 accountId);
    event ItsGreater(uint128 accountId, uint128 cmpAccountId);

    /**
     * @inheritdoc IBookOrderModule
     */
    function settleBookOrders(
        uint128 marketId,
        BookOrder[] memory orders
    ) external override returns (BookOrderSettleStatus[] memory cancelledOrders) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);
        PerpsMarket.Data storage market = PerpsMarket.loadValid(marketId);

        // loop 1: figure out the big picture change on the market
        uint256 marketSkewScale = PerpsMarketConfiguration.load(marketId).skewScale;
        {
            int256 newMarketSkew = market.skew;
            for (uint256 i = 0; i < orders.length; i++) {
                newMarketSkew += orders[i].sizeDelta;
            }
        }

        // TODO: verify total market size (?)

        // loop 2: apply the order changes to account
        PerpsAccount.MemoryContext memory ctx;
        Position.Data memory curPosition;
        AccumulatedOrderData memory accumOrderData;
        uint256 totalCollectedFees;
        for (uint256 i = 0; i < orders.length; i++) {
            if (orders[i].accountId > ctx.accountId) {
                curPosition.latestInteractionPrice = accumOrderData.price.to128();
                totalCollectedFees += _applyAggregatedAccountPosition(
                    marketId,
                    ctx,
                    curPosition,
                    accumOrderData
                );

                // load the new account
                GlobalPerpsMarket.load().checkLiquidation(orders[i].accountId);
                ctx = PerpsAccount.load(orders[i].accountId).getOpenPositionsAndCurrentPrices(
                    PerpsPrice.Tolerance.DEFAULT
                );
                // todo: is the below line necessary? in the tests I have been finding it is
                ctx.accountId = orders[i].accountId;
                accumOrderData = AccumulatedOrderData(0, 0, 0, 0);
                curPosition = market.positions[ctx.accountId];
            } else if (orders[i].accountId < ctx.accountId) {
                // order ids must be supplied in strictly ascending order
                revert ParameterError.InvalidParameter(
                    "orders",
                    "order's accountId must be increasing"
                );
            }

            curPosition.size += orders[i].sizeDelta;
            accumOrderData.sizeDelta += orders[i].sizeDelta;
            accumOrderData.orderFee += market.calculateOrderFee(
                orders[i].sizeDelta,
                orders[i].orderPrice
            );

            // the first received price for the orders for an account will be used as the settling price for the previous order. Least gamable that way.
            accumOrderData.price = accumOrderData.price == 0
                ? orders[i].orderPrice
                : accumOrderData.price;
        }

        curPosition.latestInteractionPrice = accumOrderData.price.to128();
        totalCollectedFees += _applyAggregatedAccountPosition(
            marketId,
            ctx,
            curPosition,
            accumOrderData
        );

        // send collected fees to the fee collector and etc.
        GlobalPerpsMarketConfiguration.load().collectFees(
            totalCollectedFees,
            address(0),
            PerpsMarketFactory.load()
        );

        emit BookOrderSettled(marketId, orders, totalCollectedFees);
    }

    function _applyAggregatedAccountPosition(
        uint128 marketId,
        PerpsAccount.MemoryContext memory ctx,
        Position.Data memory pos,
        AccumulatedOrderData memory accumOrderData
    ) internal returns (uint256) {
        if (ctx.accountId == 0) {
            return 0;
        }
        Position.Data memory oldPosition = PerpsMarket.load(marketId).positions[ctx.accountId];
        // charge the funding fee from the previously held position, the order fee, and whatever pnl has been accumulated from the last position.
        (int256 pnl, , uint256 chargedInterest, int256 accruedFunding, , ) = oldPosition.getPnl(
            accumOrderData.price
        );

        PerpsAccount.load(ctx.accountId).charge(pnl - accumOrderData.orderFee.toInt());

        emit AccountCharged(
            ctx.accountId,
            pnl - accumOrderData.orderFee.toInt(),
            PerpsAccount.load(ctx.accountId).debt
        );

        MarketUpdate.Data memory updateData;
        {
            PerpsMarket.Data storage market = PerpsMarket.load(marketId);

            // we recompute to the price of the first order the user set. if they set multiple trades in te timeframe, its as if they fully close their order for a short period of time
            // between the first order and the last order they place
            market.recomputeFunding(accumOrderData.price);

            // skip verifications for the account having minimum collateral.
            // this is because they are undertaken by the orderbook and cancelling them would be unnecessary complication
            // commit order to the user's account
            updateData = market.updatePositionData(ctx.accountId, pos);
        }

        PerpsAccount.load(ctx.accountId).updateOpenPositions(marketId, pos.size);

        emit MarketUpdated(
            updateData.marketId,
            accumOrderData.price,
            updateData.skew,
            PerpsMarket.load(marketId).size,
            pos.size - oldPosition.size,
            updateData.currentFundingRate,
            updateData.currentFundingVelocity,
            updateData.interestRate
        );

        return accumOrderData.orderFee;

        emit InterestCharged(ctx.accountId, chargedInterest);

        emit OrderSettled(
            marketId,
            ctx.accountId,
            accumOrderData.price,
            pnl,
            accruedFunding,
            pos.size - oldPosition.size,
            pos.size,
            accumOrderData.orderFee,
            0, // referral fees
            0, // TODO: fee collector fees
            0, // settlement reward
            "", // TODO: tracking code, may not have ever
            ERC2771Context._msgSender()
        );
    }
}
