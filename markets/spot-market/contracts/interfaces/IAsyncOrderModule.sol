//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/AsyncOrderConfiguration.sol";

interface IAsyncOrderModule {
    event OrderCommitted(
        uint128 indexed marketId,
        SpotMarketFactory.TransactionType indexed orderType,
        uint256 amountProvided,
        uint128 asyncOrderId,
        address indexed sender
    );

    event AsyncOrderSettled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrderClaim.Data asyncOrderClaim,
        uint256 finalOrderAmount,
        address indexed sender
    );

    event AsyncOrderCancelled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrderClaim.Data asyncOrderClaim,
        address indexed sender
    );

    error InsufficientFunds();

    error InsufficientAllowance(uint256 expected, uint256 current);

    error OutsideOfConfirmationWindow(
        uint256 currentTime,
        uint256 commitmentTime,
        uint256 minimumOrderAge,
        uint256 settlementWindowDuration
    );

    error InsufficientCancellationTimeElapsed(
        uint256 currentTime,
        uint256 commitmentTime,
        uint256 minimumOrderAge,
        uint256 settlementWindowDuration
    );

    function commitOrder(
        uint128 marketId,
        SpotMarketFactory.TransactionType orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId
    ) external returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim);

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external returns (uint finalOrderAmount);

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external;
}
