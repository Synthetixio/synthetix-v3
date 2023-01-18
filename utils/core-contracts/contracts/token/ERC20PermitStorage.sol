//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library ERC20PermitStorage {
    bytes32 private constant _SLOT_ERC20_PERMIT =
        keccak256(abi.encode("io.synthetix.core-contracts.ERC20Permit"));

    struct Data {
        uint256 initialChainId;
        bytes32 initialDomainSeprator;
        mapping(address => uint256) nonces;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_ERC20_PERMIT;
        assembly {
            store.slot := s
        }
    }
}
