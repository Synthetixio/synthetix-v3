//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {Position} from "../storage/Position.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {MarketUpdate} from "../storage/MarketUpdate.sol";

interface IAsyncOrderCancelModule {
    /**
     * @notice Gets thrown when attempting to cancel an order and price does not exceeds acceptable price.
     */
    error PriceNotExceeded(uint256 fillPrice, uint256 acceptablePrice);

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
        int128 newPositionSize;
        int128 sizeDelta;
        int256 pnl;
        int256 accruedFunding;
        uint256 settlementReward;
        uint256 fillPrice;
        uint256 totalFees;
        uint256 referralFees;
        uint256 feeCollectorFees;
        uint256 acceptablePrice;
        int currentAvailableMargin;
        Position.Data newPosition;
        MarketUpdate.Data updateData;
    }

    /**
     * @notice Cancels an offchain order when price exceeds the acceptable price in the settlement window. It's expected to revert with the OffchainLookup error with the data needed to perform the offchain lookup.
     * @param accountId Id of the account used for the trade.
     */
    function cancelOrder(uint128 accountId) external view;

    /**
     * @notice Cancels an offchain order when price exceeds the acceptable price in the settlement window using the offchain retrieved data from pyth.
     * @param result the blob of data retrieved offchain.
     * @param extraData Extra data from OffchainLookupData.
     */
    function cancelPythOrder(bytes calldata result, bytes calldata extraData) external payable;
}
