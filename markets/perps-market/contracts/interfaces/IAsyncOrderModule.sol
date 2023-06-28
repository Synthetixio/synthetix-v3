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
        int128 sizeDelta,
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
        int256 accountPnlRealized,
        int128 newSize,
        uint256 collectedFees,
        uint256 settelementReward,
        bytes32 indexed trackingCode,
        address settler
    );

    event OrderCanceled(
        uint128 indexed marketId,
        uint128 indexed accountId,
        uint256 settlementTime,
        uint256 acceptablePrice
    );

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

    function cancelOrder(uint128 marketId, uint128 accountId) external;

    // only used due to stack too deep during settlement
    struct SettleOrderRuntime {
        uint128 marketId;
        uint128 accountId;
        int128 newPositionSize;
        int256 pnl;
        uint256 pnlUint;
        uint256 amountToDeposit;
        uint256 settlementReward;
        bytes32 trackingCode;
    }

    function getOrder(
        uint128 marketId,
        uint128 accountId
    ) external returns (AsyncOrder.Data memory);
}
