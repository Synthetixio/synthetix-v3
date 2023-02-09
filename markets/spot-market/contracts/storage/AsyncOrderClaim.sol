//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./AsyncOrderConfiguration.sol";
import "./SpotMarketFactory.sol";

library AsyncOrderClaim {
    error OutsideSettlementWindow(uint256 timestamp, uint256 startTime, uint256 expirationTime);
    error IneligibleForCancellation(uint256 timestamp, uint256 expirationTime);
    error OrderAlreadySettled(uint256 asyncOrderId, uint256 settledAt);
    error InvalidClaim(uint256 asyncOrderId);

    struct Data {
        uint128 id;
        address owner;
        SpotMarketFactory.TransactionType orderType;
        uint256 amountEscrowed; // Amount escrowed from trader. (USD denominated on buy. Synth shares denominated on sell.)
        uint256 settlementStrategyId;
        uint256 settlementTime;
        int256 committedAmountUsd;
        uint256 minimumSettlementAmount;
        uint256 commitmentBlockNum;
        uint256 settledAt;
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
        SpotMarketFactory.TransactionType orderType,
        uint256 amountEscrowed,
        uint256 settlementStrategyId,
        uint256 settlementTime,
        int256 committedAmountUsd,
        uint256 minimumSettlementAmount,
        address owner
    ) internal returns (Data storage) {
        Data storage self = load(marketId, claimId);
        self.id = claimId;
        self.orderType = orderType;
        self.amountEscrowed = amountEscrowed;
        self.settlementStrategyId = settlementStrategyId;
        self.settlementTime = settlementTime;
        self.committedAmountUsd = committedAmountUsd;
        self.minimumSettlementAmount = minimumSettlementAmount;
        self.owner = owner;
        return self;
    }

    function checkClaimValidity(Data storage claim) internal view {
        checkIfValidClaim(claim);
        checkIfAlreadySettled(claim);
    }

    function checkIfValidClaim(Data storage claim) internal view {
        if (claim.owner == address(0) || claim.committedAmountUsd == 0) {
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
