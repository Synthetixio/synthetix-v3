//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAsyncOrderModule.sol";
import "../storage/AsyncOrder.sol";
import "../storage/Position.sol";
import "../storage/Price.sol";

contract AsyncOrderModule is IAsyncOrderModule {
    using Position for Position.Data;
    using AsyncOrder for AsyncOrder.Data;

    function commitOrder(
        uint128 marketId,
        uint256 accountId,
        int256 sizeDelta,
        uint256 settlementStrategyId,
        uint256 acceptablePrice,
        bytes32 trackingCode
    ) external override returns (AsyncOrder.Data memory retOrder, uint fees) {
        /*
            1. check valid market
            2. check valid account
            3. check valid settlement strategy
        */

        AsyncOrder.Data storage order = PerpsMarket.load(marketId).asyncOrders[accountId];

        SettlementStrategy.Data storage strategy = MarketConfiguration
            .load(marketId)
            .settlementStrategies[settlementStrategyId];

        order.update(
            sizeDelta,
            settlementStrategyId,
            block.timestamp + strategy.settlementDelay,
            acceptablePrice,
            trackingCode
        );

        (, uint feesAccrued, AsyncOrder.Status status) = order.simulateOrderSettlement(
            marketId,
            Position.load(marketId, accountId),
            Price.getCurrentPrice(marketId),
            MarketConfiguration.OrderType.ASYNC_OFFCHAIN
        );

        if (status != AsyncOrder.Status.Success) {
            revert InvalidOrder(status);
        }

        return (order, feesAccrued);
    }

    // function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
    //     revert("not implemented");
    // }

    // function getAsyncOrderClaim(
    //     uint128 marketId,
    //     uint128 asyncOrderId
    // ) external view override returns (AsyncOrderClaim.Data memory) {
    //     revert("not implemented");
    // }
}
