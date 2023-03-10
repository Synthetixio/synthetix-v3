//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/AsyncOrder.sol";
import "../storage/SettlementStrategy.sol";

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

    error InvalidOrder(AsyncOrder.Status status);
    error SettlementStrategyNotFound(SettlementStrategy.Type strategyType);
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external returns (AsyncOrder.Data memory retOrder, uint fees);

    // function cancelOrder(uint128 marketId, uint128 asyncOrderId) external;

    // function getAsyncOrderClaim(
    //     uint128 marketId,
    //     uint128 asyncOrderId /*returns (AsyncOrderClaim.Data memory)*/
    // ) external view;
}
