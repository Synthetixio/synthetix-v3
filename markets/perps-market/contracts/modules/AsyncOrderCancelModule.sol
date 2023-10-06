//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IAsyncOrderCancelModule} from "../interfaces/IAsyncOrderCancelModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {OffchainUtil} from "../utils/OffchainUtil.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";

/**
 * @title Module for cancelling async orders.
 * @dev See IAsyncOrderCancelModule.
 */
contract AsyncOrderCancelModule is IAsyncOrderCancelModule, IMarketEvents {
    using PerpsAccount for PerpsAccount.Data;
    using AsyncOrder for AsyncOrder.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;

    /**
     * @inheritdoc IAsyncOrderCancelModule
     */
    function cancelOrder(uint128 accountId) external view {
        GlobalPerpsMarket.load().checkLiquidation(accountId);
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = AsyncOrder.loadValid(accountId);

        _cancelOffchain(order, settlementStrategy);
    }

    /**
     * @inheritdoc IAsyncOrderCancelModule
     */
    function cancelPythOrder(bytes calldata result, bytes calldata extraData) external payable {
        (
            uint256 offchainPrice,
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = OffchainUtil.parsePythPrice(result, extraData);

        _cancelOrder(offchainPrice, order, settlementStrategy);
    }

    /**
     * @dev used for canceling offchain orders. This will revert with OffchainLookup.
     */
    function _cancelOffchain(
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        urls[0] = settlementStrategy.url;

        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderCancelModule.cancelPythOrder.selector;
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        // see EIP-3668: https://eips.ethereum.org/EIPS/eip-3668
        revert OffchainLookup(
            address(this),
            urls,
            abi.encodePacked(
                settlementStrategy.feedId,
                OffchainUtil.getTimeInBytes(asyncOrder.settlementTime)
            ),
            selector,
            abi.encode(asyncOrder.request.accountId) // extraData that gets sent to callback for validation
        );
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
            // deduct keeper reward
            PerpsAccount.load(runtime.accountId).deductFromAccount(runtime.settlementReward);
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
