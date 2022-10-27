//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../errors/InitError.sol";

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

    function init(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) internal returns (Data storage store) {
        store = load();

        if (bytes(store.name).length > 0 || bytes(store.symbol).length > 0 || store.decimals > 0) {
            revert InitError.AlreadyInitialized();
        }

        store.name = tokenName;
        store.symbol = tokenSymbol;
        store.decimals = tokenDecimals;
    }
}
