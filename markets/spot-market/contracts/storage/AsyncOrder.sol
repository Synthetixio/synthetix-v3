//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Fee.sol";

// Not sure this is the correct name for this, more like AsyncOrderManager
library AsyncOrder {
    using Fee for Fee.Data;

    struct Data {
        mapping(uint => AsyncOrderClaim) asyncOrderClaims;
        uint256 minimumOrderAge;
        uint256 forcedCancellationDelay;
    }

    struct AsyncOrderClaim {
        Fee.TradeType orderType;
        uint256 amountProvided; // maybe this is traderAmountEscrowed
        uint256 amountStaged; // maybe this is systemAmountEscrowed
        int256 feesQuoted;
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
