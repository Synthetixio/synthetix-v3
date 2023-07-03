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
     * @notice Gets fired when a new order is settled.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param fillPrice Price at which the order was settled.
     * @param accountPnlRealized Realized PnL of the position at the time of settlement.
     * @param newSize New size of the position after settlement.
     * @param collectedFees Amount of fees collected by the protocol.
     * @param settelementReward Amount of fees collected by the settler.
     * @param trackingCode Optional code for integrator tracking purposes.
     * @param settler address of the settler of the order.
     */
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
     * @notice Gets thrown when settle order is called with invalid settlement strategy.
     */
    error SettlementStrategyNotFound(SettlementStrategy.Type strategyType);

    /**
     * @notice Gets thrown when settle order is called as a signal to the client to perform offchain lookup.
     */
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

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
     * @notice Settles an offchain order. It's expected to revert with the OffchainLookup error with the data needed to perform the offchain lookup.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     */
    function settle(uint128 marketId, uint128 accountId) external view;

    /**
     * @notice Settles an offchain order using the offchain retrieved data from pyth.
     * @param offchainQueryResult the blob of data retrieved offchain.
     * @param extraData Extra data from OffchainLookupData.
     */
    function settlePythOrder(
        bytes calldata offchainQueryResult,
        bytes calldata extraData
    ) external payable;

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
}
