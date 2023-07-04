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
        SettlementStrategy.Type orderType,
        int128 sizeDelta,
        uint256 acceptablePrice,
        uint256 settlementTime,
        uint256 expirationTime,
        bytes32 indexed trackingCode,
        address sender
    );

    event OrderCanceled(
        uint128 indexed marketId,
        uint128 indexed accountId,
        uint256 settlementTime,
        uint256 acceptablePrice
    );

    event MarketUpdated(
        uint128 marketId,
        int256 skew,
        uint256 size,
        int256 sizeDelta,
        int256 currentFundingRate,
        int256 currentFundingVelocity
    );

    error OrderAlreadyCommitted(uint128 marketId, uint128 accountId);

    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external returns (AsyncOrder.Data memory retOrder, uint fees);

    function getOrder(
        uint128 marketId,
        uint128 accountId
    ) external returns (AsyncOrder.Data memory);

    function cancelOrder(uint128 marketId, uint128 accountId) external;
}
