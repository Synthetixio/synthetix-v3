//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC721EnumerableStorage {
    struct ERC721EnumerableStore {
        mapping(uint256 => uint256) ownedTokensIndex;
        mapping(uint256 => uint256) allTokensIndex;
        mapping(address => mapping(uint256 => uint256)) ownedTokens;
        uint256[] allTokens;
    }

    function _erc721EnumerableStore() internal pure returns (ERC721EnumerableStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.ERC721Enumerable")) - 1)
            store.slot := 0xbb177151bccee46ca610917613ed7b9846647300a31f78f4e1d2108a85c87851
        }
    }
}
