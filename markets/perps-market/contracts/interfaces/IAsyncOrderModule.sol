//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for committing and settling async orders.
 */
interface IAsyncOrderModule {
    /*event OrderCommitted(
        uint128 indexed marketId,
        Transaction.Type indexed orderType,
        uint256 amountProvided,
        uint128 asyncOrderId,
        address indexed sender
    );*/

    /*event OrderCancelled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrderClaim.Data asyncOrderClaim,
        address indexed sender
    );*/

    function commitOrder(
        uint128 marketId,
        uint256 accountId,
        int256 sizeDelta,
        uint256 settlementStrategyId,
        uint256 acceptablePrice,
        bytes32 trackingCode
    ) external returns (uint128 asyncOrderId/*, AsyncOrderClaim.Data memory asyncOrderClaim*/);

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external;

    function getAsyncOrderClaim(
        uint128 marketId,
        uint128 asyncOrderId
    ) external view /*returns (AsyncOrderClaim.Data memory)*/;
}
