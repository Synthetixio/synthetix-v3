//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {OrderFees} from "../storage/OrderFees.sol";
import {Transaction} from "../utils/TransactionUtil.sol";

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
     * @param settler address that settled the order.
     */
    event OrderSettled(
        uint128 indexed marketId,
        uint128 indexed asyncOrderId,
        uint256 finalOrderAmount,
        OrderFees.Data fees,
        uint256 collectedFees,
        address indexed settler,
        uint256 price,
        Transaction.Type orderType
    );

    /**
     * @notice Gets thrown when offchain verification returns data not associated with the order.
     */
    error InvalidVerificationResponse();

    /**
     * @notice Gets thrown when settle called with invalid settlement strategy
     */
    error InvalidSettlementStrategy(SettlementStrategy.Type strategyType);

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
     * @return OrderFees.Data breakdown of all the fees incurred for the transaction.
     */
    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external returns (uint256 finalOrderAmount, OrderFees.Data memory);
}
