//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IAsyncOrderCancelModule} from "../interfaces/IAsyncOrderCancelModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {Flags} from "../utils/Flags.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";
import {IAccountEvents} from "../interfaces/IAccountEvents.sol";
import {IPythERC7412Wrapper} from "../interfaces/external/IPythERC7412Wrapper.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Module for cancelling async orders.
 * @dev See IAsyncOrderCancelModule.
 */
contract AsyncOrderCancelModule is IAsyncOrderCancelModule, IMarketEvents, IAccountEvents {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpsAccount for PerpsAccount.Data;
    using AsyncOrder for AsyncOrder.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;

    /**
     * @inheritdoc IAsyncOrderCancelModule
     */
    function cancelOrder(uint128 accountId) external {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

        (
            AsyncOrder.Data storage asyncOrder,
            SettlementStrategy.Data storage settlementStrategy
        ) = AsyncOrder.loadValid(accountId);

        int256 offchainPrice = IPythERC7412Wrapper(settlementStrategy.priceVerificationContract)
            .getBenchmarkPrice(
                settlementStrategy.feedId,
                (asyncOrder.commitmentTime + settlementStrategy.commitmentPriceDelay).to64()
            );

        _cancelOrder(offchainPrice.toUint(), asyncOrder, settlementStrategy);
    }

    /**
     * @dev used for canceling an order.
     */
    function _cancelOrder(
        uint256 price,
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private {
        CancelOrderRuntime memory runtime;
        // Get the current data before resetting the order
        runtime.accountId = asyncOrder.request.accountId;
        runtime.marketId = asyncOrder.request.marketId;
        runtime.acceptablePrice = asyncOrder.request.acceptablePrice;
        runtime.settlementReward = settlementStrategy.settlementReward;
        runtime.sizeDelta = asyncOrder.request.sizeDelta;

        // check if account is flagged
        GlobalPerpsMarket.load().checkLiquidation(runtime.accountId);

        runtime.fillPrice = asyncOrder.validateCancellation(settlementStrategy, price);

        if (runtime.settlementReward > 0) {
            // charge account the settlement reward
            uint256 accountDebt = PerpsAccount.load(runtime.accountId).charge(
                -runtime.settlementReward.toInt()
            );

            emit AccountCharged(runtime.accountId, runtime.settlementReward.toInt(), accountDebt);

            // pay keeper
            PerpsMarketFactory.load().withdrawMarketUsd(
                ERC2771Context._msgSender(),
                runtime.settlementReward
            );
        }

        // trader can now commit a new order
        asyncOrder.reset();

        // emit event
        emit OrderCancelled(
            runtime.marketId,
            runtime.accountId,
            runtime.acceptablePrice,
            runtime.fillPrice,
            runtime.sizeDelta,
            runtime.settlementReward,
            asyncOrder.request.trackingCode,
            ERC2771Context._msgSender()
        );
    }
}
