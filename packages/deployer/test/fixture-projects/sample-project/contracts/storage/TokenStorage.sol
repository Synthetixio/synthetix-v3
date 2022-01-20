//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";

contract TokenStorage {
    struct TokenStore {
        SatelliteFactory.Satellite[] tokens;
    }

    function _tokenStore() internal pure returns (TokenStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.token")) - 1)
            store.slot := 0xcbb916258f1bef38f664846db165641d58668c10aed9984b5c6d10f1fb7ff72c
        }
    }
}
