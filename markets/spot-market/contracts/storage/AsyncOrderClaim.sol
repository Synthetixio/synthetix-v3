//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementStrategy} from "./SettlementStrategy.sol";
import {AsyncOrder} from "./AsyncOrder.sol";
import {Transaction} from "../utils/TransactionUtil.sol";

/**
 * @title Async order claim data storage
 */
library AsyncOrderClaim {
    error OutsideSettlementWindow(uint256 timestamp, uint256 startTime, uint256 expirationTime);
    error IneligibleForCancellation(uint256 timestamp, uint256 expirationTime);
    error OrderAlreadySettled(uint256 asyncOrderId, uint256 settledAt);
    error InvalidClaim(uint256 asyncOrderId);

    struct Data {
        /**
         * @dev Unique ID associated with this claim
         */
        uint128 id;
        /**
         * @dev The address that committed the order and received the exchanged amount on settlement
         */
        address owner;
        /**
         * @dev ASYNC_BUY or ASYNC_SELL. (See Transaction.Type in TransactionUtil.sol)
         */
        Transaction.Type orderType;
        /**
         * @dev The amount of assets from the trader added to escrow. This is USD denominated for buy orders and synth shares denominated for sell orders. (Synth shares are necessary in case the Decay Token has a non-zero decay rate.)
         */
        uint256 amountEscrowed;
        /**
         * @dev The ID of the settlement strategy used for this claim
         */
        uint256 settlementStrategyId;
        /**
         * @dev The time at which this order was committed.
         */
        uint256 commitmentTime;
        /**
         * @dev The minimum amount trader is willing to accept on settlement. This is USD denominated for buy orders and synth denominated for sell orders.
         */
        uint256 minimumSettlementAmount;
        /**
         * @dev The timestamp at which the claim has been settled. (The same order cannont be settled twice.)
         */
        uint256 settledAt;
        /**
         * @dev The address of the referrer for the order
         */
        address referrer;
    }

    function load(uint128 marketId, uint128 claimId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.spot-market.AsyncOrderClaim", marketId, claimId)
        );
        assembly {
            store.slot := s
        }
    }

    function create(
        uint128 marketId,
        Transaction.Type orderType,
        uint256 amountEscrowed,
        uint256 settlementStrategyId,
        uint256 minimumSettlementAmount,
        address owner,
        address referrer
    ) internal returns (Data storage claim) {
        AsyncOrder.Data storage asyncOrderData = AsyncOrder.load(marketId);
        uint128 claimId = ++asyncOrderData.totalClaims;

        Data storage self = load(marketId, claimId);
        self.id = claimId;
        self.orderType = orderType;
        self.amountEscrowed = amountEscrowed;
        self.settlementStrategyId = settlementStrategyId;
        self.commitmentTime = block.timestamp;
        self.minimumSettlementAmount = minimumSettlementAmount;
        self.owner = owner;
        self.referrer = referrer;
        return self;
    }

    function checkClaimValidity(Data storage claim) internal view {
        checkIfValidClaim(claim);
        checkIfAlreadySettled(claim);
    }

    function checkIfValidClaim(Data storage claim) internal view {
        if (claim.owner == address(0) || claim.amountEscrowed == 0) {
            revert InvalidClaim(claim.id);
        }
    }

    function checkIfAlreadySettled(Data storage claim) internal view {
        if (claim.settledAt != 0) {
            revert OrderAlreadySettled(claim.id, claim.settledAt);
        }
    }

    function checkWithinSettlementWindow(
        Data storage claim,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view {
        uint256 startTime = claim.commitmentTime + settlementStrategy.settlementDelay;
        uint256 expirationTime = startTime + settlementStrategy.settlementWindowDuration;

        if (block.timestamp < startTime || block.timestamp >= expirationTime) {
            revert OutsideSettlementWindow(block.timestamp, startTime, expirationTime);
        }
    }

    function validateCancellationEligibility(
        Data storage claim,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view {
        uint256 expirationTime = claim.commitmentTime +
            settlementStrategy.settlementDelay +
            settlementStrategy.settlementWindowDuration;

        if (block.timestamp < expirationTime) {
            revert IneligibleForCancellation(block.timestamp, expirationTime);
        }
    }
}
