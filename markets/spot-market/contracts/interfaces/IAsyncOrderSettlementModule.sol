//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/SettlementStrategy.sol";
import "../storage/OrderFees.sol";

/**
 * @title Module for committing and settling async orders.
 */
interface IAsyncOrderSettlementModule {
    /**
     * @notice Gets fired when an order is settled.
     * @param marketId Id of the market used for the trade.
     * @param asyncOrderId id of the async order.
     * @param finalOrderAmount amount returned to trader after fees.
     * @param fees breakdown of all the fees incurred for the transaction.
     * @param collectedFees fees collected by the configured fee collector.
     * @param sender trader address.
     */
    event OrderSettled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        uint256 finalOrderAmount,
        OrderFees.Data fees,
        uint collectedFees,
        address indexed sender
    );

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
     * @notice Gets thrown when offchain verification returns data not associated with the order.
     */
    error InvalidVerificationResponse();

    /**
     * @notice Gets thrown when final order amount returned to trader is less than the minimum settlement amount.
     * @dev slippage tolerance
     */
    error MinimumSettlementAmountNotMet(uint256 minimum, uint256 actual);

    /**
     * @notice Gets thrown when the settlement strategy is not found during settlement.
     * @dev this should never be thrown as there's checks during commitment, but fail safe.
     */
    error SettlementStrategyNotFound(SettlementStrategy.Type strategyType);

    /**
     * @notice Settle already created async order via this function
     * @dev if the strategy is onchain, the settlement is done similar to an atomic buy except with settlement time
     * @dev if the strategy is offchain, this function will revert with OffchainLookup error and the client should perform offchain lookup and call the callback specified see: EIP-3668
     * @param marketId Id of the market used for the trade.
     * @param asyncOrderId id of the async order created during commitment.
     * @return finalOrderAmount amount returned to trader after fees.
     * @return fees breakdown of all the fees incurred for the transaction.
     */
    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external returns (uint finalOrderAmount, OrderFees.Data memory fees);

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
    // Note: not implemented yet
    // function settleChainlinkOrder(
    //     bytes calldata result,
    //     bytes calldata extraData
    // ) external returns (uint finalOrderAmount, int totalFees, uint collectedFees);

    /**
     * @notice Callback function for Pyth settlement strategy
     * @dev This is the selector specified as callback when settlement strategy is pyth offchain.
     * @dev The data returned from the offchain lookup should be sent as "result"
     * @dev The extraData is the same as the one sent during the offchain lookup revert error. It is used to retrieve the commitment claim.
     * @dev this function expects ETH that is passed through to the Pyth contract for the fee it's charging.
     * @dev To determine the fee, the client should first call getUpdateFee() from Pyth's verifier contract.
     * @param result result returned from the offchain lookup.
     * @param extraData extra data sent during the offchain lookup revert error.
     * @return finalOrderAmount amount returned to trader after fees.
     * @return fees breakdown of all the fees incurred for the transaction.
     */
    function settlePythOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external payable returns (uint finalOrderAmount, OrderFees.Data memory fees);
}
