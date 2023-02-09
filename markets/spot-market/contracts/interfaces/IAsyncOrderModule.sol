//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/AsyncOrderConfiguration.sol";
import "../storage/AsyncOrderClaim.sol";

interface IAsyncOrderModule {
    event OrderCommitted(
        uint128 indexed marketId,
        SpotMarketFactory.TransactionType indexed orderType,
        uint256 amountProvided,
        uint128 asyncOrderId,
        address indexed sender
    );

    event OrderSettled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        uint256 finalOrderAmount,
        int totalFees,
        uint collectedFees,
        address indexed sender
    );

    event OrderCancelled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrderClaim.Data asyncOrderClaim,
        address indexed sender
    );

    error SettlementStrategyNotFound(SettlementStrategy.Type strategyType);

    error InvalidVerificationResponse();

    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    error MinimumSettlementAmountNotMet(uint256 minimum, uint256 actual);

    function commitOrder(
        uint128 marketId,
        SpotMarketFactory.TransactionType orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId,
        uint256 minimumSettlementAmount
    ) external returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim);

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external returns (uint finalOrderAmount, int totalFees, uint collectedFees);

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external;

    function getAsyncOrderClaim(
        uint128 marketId,
        uint128 asyncOrderId
    ) external view returns (AsyncOrderClaim.Data memory);
}
