//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/Ownable.sol";

contract OwnableParent is Ownable {
    constructor(address ownerCtor) Ownable(ownerCtor) {}

    function sum(uint256 a, uint256 b) public view onlyOwner returns (uint256) {
        return a + b;
    }
}
