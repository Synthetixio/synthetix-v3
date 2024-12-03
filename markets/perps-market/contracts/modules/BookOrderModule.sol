//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {IBookOrderModule} from "../interfaces/IBookOrderModule.sol";
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
contract BookOrderModule is IBookOrderModule {
    using AsyncOrder for AsyncOrder.Data;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarket for PerpsMarket.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;

    struct AccumulatedOrderData {
        uint256 orderFee;
        int256 sizeDelta;
        uint256 orderCount;
    }

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
        int256 newMarketSkew = market.skew;
        uint256 marketSkewScale = PerpsMarketConfiguration.load(marketId).skewScale;
        for (uint256 i = 0; i < orders.length; i++) {
            newMarketSkew += orders[i].sizeDelta;
        }

        // TODO: verify total market size (?)

        // loop 2: apply the order changes to account
        PerpsAccount.MemoryContext memory ctx;
        Position.Data memory oldPosition;
        Position.Data memory curPosition;
        AccumulatedOrderData memory accumOrderData;
        int256 accumulatedSizeDelta;
        uint256 totalCollectedFees;
        for (uint256 i = 0; i < orders.length; i++) {
            BookOrder memory order = orders[i];
            if (order.accountId > ctx.accountId) {
                if (ctx.accountId > 0) {
                    // charge the funding fee, the order fee, and whatever pnl has been accumulated from the last position.
                    (int256 pnl, , uint256 chargedInterest, int256 accruedFunding, , ) = oldPosition
                        .getPnl(order.orderPrice);

                    PerpsAccount.load(order.accountId).charge(
                        pnl - accumOrderData.orderFee.toInt()
                    );
                    totalCollectedFees += accumOrderData.orderFee;
                    (
                        uint256 totalNonDiscountedCollateralValue,
                        uint256 totalDiscountedCollateralValue
                    ) = PerpsAccount.load(order.accountId).getTotalCollateralValue(
                            PerpsPrice.Tolerance.DEFAULT
                        );

                    // verify that the account is in valid state. should have required initial margin
                    // if account is not in valid state, immediately close their orders (they will still be charged fees)
                    // TODO: check
                    (uint256 requiredInitialMargin, , uint256 liquidationReward) = PerpsAccount
                        .getAccountRequiredMargins(ctx, totalNonDiscountedCollateralValue);

                    if (
                        totalDiscountedCollateralValue < requiredInitialMargin + liquidationReward
                    ) {
                        // cancel order because it does not work with the user's margin.
                    } else {
                        // commit order to the user's account
                        MarketUpdate.Data memory updateData = market.updatePositionData(
                            ctx.accountId,
                            curPosition
                        );
                        PerpsAccount.load(order.accountId).updateOpenPositions(
                            marketId,
                            curPosition.size
                        );
                    }
                }

                // load the new account
                // Check if commitment.accountId is valid
                GlobalPerpsMarket.load().checkLiquidation(order.accountId);
                ctx = PerpsAccount.load(order.accountId).getOpenPositionsAndCurrentPrices(
                    PerpsPrice.Tolerance.DEFAULT
                );
                oldPosition = ctx.positions[PerpsAccount.findPositionByMarketId(ctx, marketId)];
                curPosition = oldPosition;
                accumOrderData = AccumulatedOrderData(0, 0, 0);
            } else if (order.accountId < ctx.accountId) {
                // order ids must be supplied in strictly ascending order
                revert ParameterError.InvalidParameter(
                    "orders",
                    "order's accountId must be increasing"
                );
            }

            curPosition.size += order.sizeDelta;
            accumOrderData.sizeDelta += order.sizeDelta;
            accumOrderData.orderFee += market.calculateOrderFee(order.sizeDelta, order.orderPrice);
            // TODO: emit event for each order settled (alternatively, if we decide otherwise, we can emit just one event after they are aggregated together)
        }

        // send collected fees to the fee collector and etc.
        GlobalPerpsMarketConfiguration.load().collectFees(
            totalCollectedFees,
            address(0),
            PerpsMarketFactory.load()
        );

        // TODO: emit event
    }
}
