//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";

/**
 * @title Module for committing and settling async orders.
 */
interface IAsyncOrderModule {
    event OrderCommitted(
        uint128 indexed marketId,
        uint128 indexed accountId,
        SettlementStrategy.Type indexed orderType,
        int256 sizeDelta,
        uint256 acceptablePrice,
        uint256 settlementTime,
        uint256 expirationTime,
        bytes32 trackingCode,
        address sender
    );

    event OrderSettled(
        uint128 indexed marketId,
        uint128 indexed accountId,
        uint256 fillPrice,
        int128 newSize,
        uint256 collectedFees,
        uint256 settelementReward,
        bytes32 trackingCode,
        address indexed settler
    );

    /*event OrderCancelled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrderClaim.Data asyncOrderClaim,
        address indexed sender
    );*/

    error OrderAlreadyCommitted(uint128 marketId, uint128 accountId);
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
