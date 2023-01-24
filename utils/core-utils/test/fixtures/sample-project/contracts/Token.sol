//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import {ERC721 as ERC721Base} from "@synthetixio/core-contracts/contracts/token/ERC721.sol";

contract Token is ERC20 {
    constructor(string memory name) {
        _initialize(name, "T", 0);
    }
}

contract AnotherToken is ERC721Base {
    constructor(string memory name) {
        _initialize(name, "T", "ipfs://abc");
    }
}
