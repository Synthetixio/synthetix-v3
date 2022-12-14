//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ERC20PermitStorage {
    struct Data {
        uint256 initialChainId;
        bytes32 initialDomainSeprator;
        mapping(address => uint256) nonces;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC20PermitStorage"));
        assembly {
            store.slot := s
        }
    }
}
