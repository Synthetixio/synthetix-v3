//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library DecayTokenStorage {
    bytes32 private constant _SLOT_DECAY_TOKEN_STORAGE =
        keccak256(abi.encode("io.synthetix.core-contracts.DecayToken"));

    struct Data {
        uint256 interestRate;
        uint256 epochStart;
        uint256 totalSupplyAtEpochStart;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_DECAY_TOKEN_STORAGE;
        assembly {
            store.slot := s
        }
    }
}
