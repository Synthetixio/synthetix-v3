//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/AsyncOrder.sol";

interface IAsyncOrderModule {
    event AsyncOrderCommitted(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrderClaim.Data asyncOrderClaim,
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

    function commitBuyOrder(
        uint128 marketId,
        uint usdAmount
    ) external returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim);

    function commitSellOrder(
        uint128 marketId,
        uint256 synthAmount
    ) external returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim);

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external returns (uint finalOrderAmount);

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external;
}
