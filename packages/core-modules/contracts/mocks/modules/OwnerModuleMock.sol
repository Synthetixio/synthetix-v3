//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../modules/CoreOwnerModule.sol";

contract OwnerModuleMock is CoreOwnerModule {
    uint public value;

    constructor(address firstOwner) {
        _ownableStore().owner = firstOwner;
    }

    function protectedFn(uint newValue) public onlyOwner {
        value = newValue;
    }
}
