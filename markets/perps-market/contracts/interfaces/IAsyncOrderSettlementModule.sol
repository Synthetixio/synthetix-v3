//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {Position} from "../storage/Position.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";

interface IAsyncOrderSettlementModule {
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
     * @notice Gets fired when a new order is settled.
     * @param marketId Id of the market used for the trade.
     * @param accountId Id of the account used for the trade.
     * @param fillPrice Price at which the order was settled.
     * @param pnl Pnl of the previous closed position.
     * @param accruedFunding Accrued funding of the previous closed position.
     * @param sizeDelta Size delta from order.
     * @param newSize New size of the position after settlement.
     * @param totalFees Amount of fees collected by the protocol.
     * @param referralFees Amount of fees collected by the referrer.
     * @param collectedFees Amount of fees collected by fee collector.
     * @param settlementReward Amount of fees collected by the settler.
     * @param trackingCode Optional code for integrator tracking purposes.
     * @param settler address of the settler of the order.
     */
    event OrderSettled(
        uint128 indexed marketId,
        uint128 indexed accountId,
        uint256 fillPrice,
        int256 pnl,
        int256 accruedFunding,
        int128 sizeDelta,
        int128 newSize,
        uint256 totalFees,
        uint256 referralFees,
        uint256 collectedFees,
        uint256 settlementReward,
        bytes32 indexed trackingCode,
        address settler
    );

    // only used due to stack too deep during settlement
    struct SettleOrderRuntime {
        uint128 marketId;
        uint128 accountId;
        int128 newPositionSize;
        int128 sizeDelta;
        int256 pnl;
        int256 accruedFunding;
        uint256 pnlUint;
        uint256 amountToDeduct;
        uint256 settlementReward;
        uint256 fillPrice;
        uint256 totalFees;
        uint256 referralFees;
        uint256 feeCollectorFees;
        Position.Data newPosition;
        PerpsMarket.MarketUpdateData updateData;
    }

    /**
     * @notice Settles an offchain order. It's expected to revert with the OffchainLookup error with the data needed to perform the offchain lookup.
     * @param accountId Id of the account used for the trade.
     */
    function settle(uint128 accountId) external view;

    /**
     * @notice Settles an offchain order using the offchain retrieved data from pyth.
     * @param result the blob of data retrieved offchain.
     * @param extraData Extra data from OffchainLookupData.
     */
    function settlePythOrder(bytes calldata result, bytes calldata extraData) external payable;
}
