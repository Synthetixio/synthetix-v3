//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Fee.sol";
import "./AsyncOrderClaim.sol";

// Not sure this is the correct name for this, more like AsyncOrderManager
library AsyncOrder {
    struct Data {
        mapping(uint256 => AsyncOrderClaim.Data) asyncOrderClaims;
        uint256 minimumOrderAge;
        uint256 settlementWindowDuration;
        uint256 livePriceSettlementWindowDuration; // This is an options duration at the end fo the settleWindowDuration where a price with timestamp == 0 will be accepted
        mapping(address => uint256) escrowedSynthShares;
        uint256 totalEscrowedSynthShares;
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
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) internal {
        update(load(marketId), asyncOrderId, asyncOrderClaim);
    }

    function update(
        Data storage self,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data memory asyncOrderClaim
    ) internal {
        self.asyncOrderClaims[asyncOrderId] = asyncOrderClaim;
    }
}
