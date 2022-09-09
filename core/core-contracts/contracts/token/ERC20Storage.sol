//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC20Storage {
    struct ERC20Store {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => uint256) balanceOf;
        mapping(address => mapping(address => uint256)) allowance;
        uint256 totalSupply;
    }

    function _erc20Store() internal pure returns (ERC20Store storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.ERC20")) - 1)
            store.slot := 0x6778cc3893ab2b9879ff6c7efa3c09530eca8fd1ff3491476ce0c0e67212ae5f
        }
    }
}
