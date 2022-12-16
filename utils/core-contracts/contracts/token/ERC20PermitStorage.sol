//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ERC20PermitStorage {
    bytes32 private constant _slotERC20Permit =
        keccak256(abi.encode("io.synthetix.core-contracts.ERC20Permit"));

    struct Data {
        uint256 initialChainId;
        bytes32 initialDomainSeprator;
        mapping(address => uint256) nonces;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _slotERC20Permit;
        assembly {
            store.slot := s
        }
    }
}
