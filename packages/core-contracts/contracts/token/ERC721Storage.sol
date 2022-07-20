//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC721Storage {
    struct ERC721Store {
        string name;
        string symbol;
        string baseTokenURI;
        mapping(uint256 => address) ownerOf;
        mapping(address => uint256) balanceOf;
        mapping(uint256 => address) tokenApprovals;
        mapping(address => mapping(address => bool)) operatorApprovals;
    }

    function _erc721Store() internal pure returns (ERC721Store storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.ERC721")) - 1)
            store.slot := 0xcff586616dbfd8fcbd4d6ec876c80f6e96179ad989cea8424b590d1e270e5bcf
        }
    }
}
