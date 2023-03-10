//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/AsyncOrderConfiguration.sol";
import "../storage/AsyncOrderClaim.sol";
import "../utils/TransactionUtil.sol";

/**
 * @title Module for committing and settling async orders.
 */
interface IAsyncOrderModule {
    /**
     * @notice Gets fired when a new order is committed.
     * @param marketId Id of the market used for the trade.
     * @param orderType Should send either 2 or 3 which correlates to the transaction type enum defined in Transaction.Type.
     * @param amountProvided amount of value provided by the user for trade.
     * @param asyncOrderId id of the async order created (used for settlements).
     * @param sender trader address.
     * @param referrer Optional address of the referrer, for fee share
     */
    event OrderCommitted(
        uint128 indexed marketId,
        Transaction.Type indexed orderType,
        uint256 amountProvided,
        uint128 asyncOrderId,
        address indexed sender,
        address referrer
    );

    /**
     * @notice Gets fired when an order is cancelled.
     * @param marketId Id of the market used for the trade.
     * @param asyncOrderId id of the async order.
     * @param asyncOrderClaim claim details (see AsyncOrderClaim.Data struct).
     * @param sender trader address and also the receiver of the funds.
     */
    event OrderCancelled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        AsyncOrderClaim.Data asyncOrderClaim,
        address indexed sender
    );

    /**
     * @notice Commit an async order via this function
     * @dev commitment transfers the amountProvided into the contract and escrows the funds until settlement.
     * @param marketId Id of the market used for the trade.
     * @param orderType Should send either 2 or 3 which correlates to the transaction type enum defined in Transaction.Type.
     * @param amountProvided amount of value provided by the user for trade. Should have enough allowance.
     * @param settlementStrategyId id of the settlement strategy used for trade.
     * @param minimumSettlementAmount minimum amount of value returned to trader after fees.
     * @param referrer Optional address of the referrer, for fee share
     * @return asyncOrderClaim claim details (see AsyncOrderClaim.Data struct).
     */
    function commitOrder(
        uint128 marketId,
        Transaction.Type orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId,
        uint256 minimumSettlementAmount,
        address referrer
    ) external returns (AsyncOrderClaim.Data memory asyncOrderClaim);

    /**
     * @notice Cancel an async order via this function
     * @dev cancellation transfers the amountProvided back to the trader without any fee collection
     * @dev cancellation can only happen after the settlement time has passed
     * @dev needs to satisfy commitmentTime + settlementDelay + settlementDuration < block.timestamp
     * @param marketId Id of the market used for the trade.
     * @param asyncOrderId id of the async order created during commitment.
     */
    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external;

    /**
     * @notice Get async order claim details
     * @param marketId Id of the market used for the trade.
     * @param asyncOrderId id of the async order created during commitment.
     * @return asyncOrderClaim claim details (see AsyncOrderClaim.Data struct).
     */
    function getAsyncOrderClaim(
        uint128 marketId,
        uint128 asyncOrderId
    ) external view returns (AsyncOrderClaim.Data memory);
}
