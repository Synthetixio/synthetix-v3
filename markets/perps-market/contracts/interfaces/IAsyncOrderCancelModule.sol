//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {Position} from "../storage/Position.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {MarketUpdate} from "../storage/MarketUpdate.sol";

interface IAsyncOrderCancelModule {
    /**
     * @notice Gets fired when an order is cancelled.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param desiredPrice Price at which the order was cancelled.
     * @param fillPrice Price at which the order was cancelled.
     * @param sizeDelta Size delta from order.
     * @param settlementReward Amount of fees collected by the settler.
     * @param trackingCode Optional code for integrator tracking purposes.
     * @param settler address of the settler of the order.
     */
    event OrderCancelled(
        uint128 indexed marketId,
        uint128 indexed accountId,
        uint256 desiredPrice,
        uint256 fillPrice,
        int128 sizeDelta,
        uint256 settlementReward,
        bytes32 indexed trackingCode,
        address settler
    );

    // only used due to stack too deep during settlement
    struct CancelOrderRuntime {
        uint128 marketId;
        uint128 accountId;
        int128 sizeDelta;
        uint256 settlementReward;
        uint256 fillPrice;
        uint256 acceptablePrice;
    }

    /**
     * @notice Cancels an order when price exceeds the acceptable price. Uses the onchain benchmark price at commitment time.
     * @param accountId Id of the account used for the trade.
     */
    function cancelOrder(uint128 accountId) external;
}
