//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ERC721EnumerableStorage {
    bytes32 private constant _slotERC721EnumerableStorage =
        keccak256(abi.encode("io.synthetix.core-contracts.ERC721Enumerable"));

    struct Data {
        mapping(uint256 => uint256) ownedTokensIndex;
        mapping(uint256 => uint256) allTokensIndex;
        mapping(address => mapping(uint256 => uint256)) ownedTokens;
        uint256[] allTokens;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _slotERC721EnumerableStorage;
        assembly {
            store.slot := s
        }
    }
}
