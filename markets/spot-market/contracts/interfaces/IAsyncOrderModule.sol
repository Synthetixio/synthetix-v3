//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/AsyncOrder.sol";

interface IAsyncOrderModule {
    event AsyncOrderCommitted(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrder.AsyncOrderClaim asyncOrderClaim,
        address indexed sender
    );

    event AsyncOrderSettled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrder.AsyncOrderClaim asyncOrderClaim,
        uint256 finalOrderAmount,
        address indexed sender
    );

    event AsyncOrderCancelled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrder.AsyncOrderClaim asyncOrderClaim,
        address indexed sender
    );

    error InsufficientFunds(); // TODO: add params

    error InsufficientAllowance(uint256 expected, uint256 current);

    error OutsideOfConfirmationWindow(
        uint256 currentTime,
        uint256 commitmentTime,
        uint256 minimumOrderAge,
        uint256 confirmationWindowDuration
    );

    error InsufficientCancellationTimeElapsed(); // TODO: add params

    function commitBuyOrder(
        uint128 marketId,
        uint usdAmount,
        bytes[] calldata priceUpdateData
    ) external returns (uint128 asyncOrderId, AsyncOrder.AsyncOrderClaim memory asyncOrderClaim);

    function commitSellOrder(
        uint128 marketId,
        uint256 synthAmount,
        bytes[] calldata priceUpdateData
    ) external returns (uint128 asyncOrderId, AsyncOrder.AsyncOrderClaim memory asyncOrderClaim);

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        bytes[] calldata priceUpdateData
    ) external returns (uint finalOrderAmount);

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external;
}
