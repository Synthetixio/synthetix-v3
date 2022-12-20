//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Fee.sol";

// Not sure this is the correct name for this, more like AsyncOrderManager
library AsyncOrder {
    struct Data {
        mapping(uint256 => AsyncOrderClaim) asyncOrderClaims;
        uint256 minimumOrderAge;
        uint256 settlementWindowDuration;
        uint256 livePriceSettlementWindowDuration; // This is an options duration at the end fo the settleWindowDuration where a price with timestamp == 0 will be accepted
        mapping(address => uint256) escrowedSynthShares;
        uint256 totalEscrowedSynthShares;
    }

    struct AsyncOrderClaim {
        SpotMarketFactory.TransactionType orderType;
        uint256 traderAmountEscrowed;
        uint256 systemAmountEscrowed;
        uint256 feesQuoted;
        uint256 blockNumber;
        uint256 timestamp;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.AsyncOrder", marketId));
        assembly {
            store.slot := s
        }
    }

    function create(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim memory asyncOrderClaim
    ) internal {
        update(load(marketId), asyncOrderId, asyncOrderClaim);
    }

    function update(
        Data storage self,
        uint128 asyncOrderId,
        AsyncOrderClaim memory asyncOrderClaim
    ) internal {
        self.asyncOrderClaims[asyncOrderId] = asyncOrderClaim;
    }
}
