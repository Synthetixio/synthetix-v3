//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ERC20Storage {
    struct Data {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => uint256) balanceOf;
        mapping(address => mapping(address => uint256)) allowance;
        uint256 totalSupply;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC20"));
        assembly {
            store.slot := s
        }
    }
}
