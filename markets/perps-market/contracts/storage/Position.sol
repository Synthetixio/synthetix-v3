//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library Position {
    struct Data {
        int128 sizeDelta;
        uint128 latestInteractionPrice;
        uint128 latestInteractionMargin;
        uint128 latestInteractionFunding;
    }

    function load(uint128 marketId, uint256 accountId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(
            abi.encode("io.synthetix.perps-market.AsyncOrder", marketId, accountId)
        );
        assembly {
            store.slot := s
        }
    }
}
