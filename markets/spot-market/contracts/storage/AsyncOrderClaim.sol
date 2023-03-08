//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./SettlementStrategy.sol";
import "../utils/TransactionUtil.sol";

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
         * @dev unique id for claim
         */
        uint128 id;
        /**
         * @dev address that gets the final settlement amount, also the address that committed the order
         */
        address owner;
        /**
         * @dev can only be async buy or async sell (see: Transaction.Type)
         */
        Transaction.Type orderType;
        /**
         * @dev amount escrowed from trader. (USD denominated on buy. Synth shares denominated on sell.)
         */
        uint256 amountEscrowed;
        /**
         * @dev id of settlement strategy used for this claim
         */
        uint256 settlementStrategyId;
        /**
         * @dev settlementTime = commitment block time + settlement delay
         */
        uint256 settlementTime;
        /**
         * @dev minimum amount trader is willing to accept on settlement.
         */
        uint256 minimumSettlementAmount;
        /**
         * @dev timestamp of when the claim was settled.  this is used to prevent double settlement.
         */
        uint256 settledAt;
        /**
         * @dev address of the referrer for the order
         */
        address referrer;
    }

    function load(uint128 marketId, uint256 claimId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.spot-market.AsyncOrderClaim", marketId, claimId)
        );
        assembly {
            store.slot := s
        }
    }

    function create(
        uint128 marketId,
        uint128 claimId,
        Transaction.Type orderType,
        uint256 amountEscrowed,
        uint256 settlementStrategyId,
        uint256 settlementTime,
        uint256 minimumSettlementAmount,
        address owner,
        address referrer
    ) internal returns (Data storage) {
        Data storage self = load(marketId, claimId);
        self.id = claimId;
        self.orderType = orderType;
        self.amountEscrowed = amountEscrowed;
        self.settlementStrategyId = settlementStrategyId;
        self.settlementTime = settlementTime;
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
        uint startTime = claim.settlementTime;
        uint expirationTime = startTime + settlementStrategy.settlementWindowDuration;

        if (block.timestamp < startTime || block.timestamp >= expirationTime) {
            revert OutsideSettlementWindow(block.timestamp, startTime, expirationTime);
        }
    }

    function isEligibleForCancellation(
        Data storage claim,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view {
        uint expirationTime = claim.settlementTime + settlementStrategy.settlementWindowDuration;

        if (block.timestamp < expirationTime) {
            revert IneligibleForCancellation(block.timestamp, expirationTime);
        }
    }
}
