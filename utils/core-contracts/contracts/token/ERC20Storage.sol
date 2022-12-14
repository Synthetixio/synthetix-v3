//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ERC20Storage {
    bytes32 private constant _slotERC20Storage =
        keccak256(abi.encode("io.synthetix.core-contracts.ERC20"));

    struct Data {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => uint256) balanceOf;
        mapping(address => mapping(address => uint256)) allowance;
        uint256 totalSupply;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _slotERC20Storage;
        assembly {
            store.slot := s
        }
    }
}
