//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";

contract SUSDTokenStorage {
    struct SUSDTokenStore {
        bool initialized;
        SatelliteFactory.Satellite sUSDToken;
    }

    function _sUSDTokenStore() internal pure returns (SUSDTokenStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.susdtoken")) - 1)
            store.slot := 0x2342c0bf00f8a01ac24cb928182ec53c26148864e7bdcf779533fd355508ddfd
        }
    }
}
