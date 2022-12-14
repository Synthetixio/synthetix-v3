//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ERC721Storage {
    bytes32 private constant _slotERC721Storage =
        keccak256(abi.encode("io.synthetix.core-contracts.ERC721"));

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
        bytes32 s = _slotERC721Storage;
        assembly {
            store.slot := s
        }
    }
}
