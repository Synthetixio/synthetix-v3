//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";

/**
 * @title Module for committing and settling async orders.
 */
interface IAsyncOrderModule {
    /**
     * @notice Gets fired when a new order is committed.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param orderType Should send 0 (at time of writing) that correlates to the transaction type enum defined in SettlementStrategy.Type.
     * @param sizeDelta requested change in size of the order sent by the user.
     * @param acceptablePrice maximum or minimum, depending on the sizeDelta direction, accepted price to settle the order, set by the user.
     * @param settlementTime Time at which the order can be settled.
     * @param expirationTime Time at which the order expired.
     * @param trackingCode Optional code for integrator tracking purposes.
     * @param sender address of the sender of the order. Authorized to commit by account owner.
     */
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

    /**
     * @notice Gets fired when a new order is canceled.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param acceptablePrice maximum or minimum, depending on the sizeDelta direction, accepted price to settle the order, set by the user.
     * @param settlementTime Time at which the order can be settled.
     */

    event OrderCanceled(
        uint128 indexed marketId,
        uint128 indexed accountId,
        uint256 settlementTime,
        uint256 acceptablePrice
    );

    /**
     * @notice Gets thrown when commit order is called when a pending order already exists.
     */
    error OrderAlreadyCommitted(uint128 marketId, uint128 accountId);

    /**
     * @notice Commit an async order via this function
     * @param commitment Order commitment data (see AsyncOrder.OrderCommitmentRequest struct).
     * @return retOrder order details (see AsyncOrder.Data struct).
     * @return fees order fees (protocol + settler)
     */
    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external returns (AsyncOrder.Data memory retOrder, uint fees);

    /**
     * @notice Cancel an expired order via this function
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     */
    function cancelOrder(uint128 marketId, uint128 accountId) external;

    /**
     * @notice Get an order details via this function
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @return order order details (see AsyncOrder.Data struct).
     */
    function getOrder(
        uint128 marketId,
        uint128 accountId
    ) external returns (AsyncOrder.Data memory order);
}
