//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ERC721Storage {
    struct Data {
        string name;
        string symbol;
        string baseTokenURI;
        mapping(uint256 => address) ownerOf;
        mapping(address => uint256) balanceOf;
        mapping(uint256 => address) tokenApprovals;
        mapping(address => mapping(address => bool)) operatorApprovals;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC721"));
        assembly {
            store.slot := s
        }
    }
}
