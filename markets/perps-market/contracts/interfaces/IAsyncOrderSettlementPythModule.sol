//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Position} from "../storage/Position.sol";
import {MarketUpdate} from "../storage/MarketUpdate.sol";

interface IAsyncOrderSettlementPythModule {
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
     * @param settlementReward reward to sender for settling order.
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

    /**
     * @notice Gets fired after order settles and includes the interest charged to the account.
     * @param accountId Id of the account used for the trade.
     * @param interest interest charges
     */
    event InterestCharged(uint128 indexed accountId, uint256 interest);

    // only used due to stack too deep during settlement
    struct SettleOrderRuntime {
        uint128 marketId;
        uint128 accountId;
        int128 sizeDelta;
        int256 pnl;
        uint256 chargedInterest;
        int256 accruedFunding;
        uint256 settlementReward;
        uint256 fillPrice;
        uint256 totalFees;
        uint256 referralFees;
        uint256 feeCollectorFees;
        Position.Data newPosition;
        MarketUpdate.Data updateData;
        uint256 synthDeductionIterator;
        uint128[] deductedSynthIds;
        uint256[] deductedAmount;
        int256 chargedAmount;
        uint256 newAccountDebt;
    }

    /**
     * @notice Settles an offchain order using the offchain retrieved data from pyth.
     * @param accountId The account id to settle the order
     */
    function settleOrder(uint128 accountId) external;
}
