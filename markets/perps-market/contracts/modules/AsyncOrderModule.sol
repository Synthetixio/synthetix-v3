//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAsyncOrderModule.sol";
import "../storage/AsyncOrder.sol";
import "../storage/Position.sol";

contract AsyncOrderModule is IAsyncOrderModule {
    using Position for Position.Data;

    function commitOrder(
        uint128 marketId,
        uint256 accountId,
        int256 sizeDelta,
        uint256 settlementStrategyId,
        uint256 acceptablePrice,
        bytes32 trackingCode
    ) external override returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim) {
        /*
            1. check valid market
            2. check valid account
            3. create order
        */

        AsyncAccountOrder.Data storage order = AsyncOrder.create(
            marketId,
            accountId,
            sizeDelta,
            settlementStrategyId,
            acceptablePrice,
            trackingCode
        );

        order.simulateOrderSettlement(Position.load(marketId, accountId), Price.load(marketId).getPrice(), MarketConfiguration.OrderType.ASYNC_OFFCHAIN);

        SettlementStrategy memory strategy = settlementStrategies[settlementStrategyId];


        revert("not implemented");
    }

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        revert("not implemented");
    }

    function getAsyncOrderClaim(
        uint128 marketId,
        uint128 asyncOrderId
    ) external view override returns (AsyncOrderClaim.Data memory) {
        revert("not implemented");
    }
}
