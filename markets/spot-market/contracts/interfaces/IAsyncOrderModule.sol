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
     */
    event OrderCommitted(
        uint128 indexed marketId,
        Transaction.Type indexed orderType,
        uint256 amountProvided,
        uint128 asyncOrderId,
        address indexed sender
    );

    /**
     * @notice Gets fired when an order is settled.
     * @param marketId Id of the market used for the trade.
     * @param asyncOrderId id of the async order.
     * @param finalOrderAmount amount returned to trader after fees.
     * @param totalFees total fees for the transaction.
     * @param collectedFees fees collected by the configured fee collector.
     * @param sender trader address.
     */
    event OrderSettled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        uint256 finalOrderAmount,
        int totalFees,
        uint collectedFees,
        address indexed sender
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
     * @notice Gets thrown when the settlement strategy is not found during settlement.
     * @dev this should never be thrown as there's checks during commitment, but fail safe.
     */
    error SettlementStrategyNotFound(SettlementStrategy.Type strategyType);

    /**
     * @notice Gets thrown when offchain verification returns data not associated with the order.
     */
    error InvalidVerificationResponse();

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
     * @notice Gets thrown when final order amount returned to trader is less than the minimum settlement amount.
     * @dev slippage tolerance
     */
    error MinimumSettlementAmountNotMet(uint256 minimum, uint256 actual);

    /**
     * @notice Commit an async order via this function
     * @dev commitment transfers the amountProvided into the contract and escrows the funds until settlement.
     * @param marketId Id of the market used for the trade.
     * @param orderType Should send either 2 or 3 which correlates to the transaction type enum defined in Transaction.Type.
     * @param amountProvided amount of value provided by the user for trade. Should have enough allowance.
     * @param settlementStrategyId id of the settlement strategy used for trade.
     * @param minimumSettlementAmount minimum amount of value returned to trader after fees.
     * @return asyncOrderId id of the async order created (used for settlements).
     * @return asyncOrderClaim claim details (see AsyncOrderClaim.Data struct).
     */
    function commitOrder(
        uint128 marketId,
        Transaction.Type orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId,
        uint256 minimumSettlementAmount
    ) external returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim);

    /**
     * @notice Settle already created async order via this function
     * @dev if the strategy is onchain, the settlement is done similar to an atomic buy except with settlement time
     * @dev if the strategy is offchain, this function will revert with OffchainLookup error and the client should perform offchain lookup and call the callback specified see: EIP-3668
     * @param marketId Id of the market used for the trade.
     * @param asyncOrderId id of the async order created during commitment.
     * @return finalOrderAmount amount returned to trader after fees.
     * @return totalFees total fees for the transaction.
     * @return collectedFees fees collected by the configured fee collector.
     */
    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external returns (uint finalOrderAmount, int totalFees, uint collectedFees);

    /**
     * @notice Callback function for chainlink settlement strategy
     * @dev This is the selector specified as callback when settlement strategy type is chainlinkoffchain.
     * @dev The data returned from the offchain lookup should be sent as "result"
     * @dev The extraData is the same as the one sent during the offchain lookup revert error. It is used to retrieve the commitment claim.
     * @param result result returned from the offchain lookup.
     * @param extraData extra data sent during the offchain lookup revert error.
     * @return finalOrderAmount amount returned to trader after fees.
     * @return totalFees total fees for the transaction.
     * @return collectedFees fees collected by the configured fee collector.
     */
    function settleChainlinkOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external returns (uint finalOrderAmount, int totalFees, uint collectedFees);

    /**
     * @notice Callback function for Pyth settlement strategy
     * @dev This is the selector specified as callback when settlement strategy is pyth offchain.
     * @dev The data returned from the offchain lookup should be sent as "result"
     * @dev The extraData is the same as the one sent during the offchain lookup revert error. It is used to retrieve the commitment claim.
     * @param result result returned from the offchain lookup.
     * @param extraData extra data sent during the offchain lookup revert error.
     * @return finalOrderAmount amount returned to trader after fees.
     * @return totalFees total fees for the transaction.
     * @return collectedFees fees collected by the configured fee collector.
     */
    function settlePythOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external returns (uint finalOrderAmount, int totalFees, uint collectedFees);

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
