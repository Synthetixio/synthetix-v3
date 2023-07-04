//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";

interface IAsyncOrderSettlementModule {
    error SettlementStrategyNotFound(SettlementStrategy.Type strategyType);
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

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

    function settle(uint128 marketId, uint128 accountId) external;

    function settlePythOrder(bytes calldata result, bytes calldata extraData) external payable;
}
