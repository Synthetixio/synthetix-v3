// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {MockERC20} from "forge-std/mocks/MockERC20.sol";

contract MintableToken is MockERC20 {
    constructor(string memory _symbol, uint8 _decimals) {
        initialize(string.concat("Mintable token ", _symbol), _symbol, _decimals);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
