//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/GlobalStorage.sol";

contract SomeModule is GlobalStorage {
    event UintValueSet(address sender, uint value);

    function setUintValue(uint newValue) public {
        _globalStore().uintValue = newValue;

        emit UintValueSet(msg.sender, newValue);
    }

    function getUintValue() public view returns (uint) {
        return _globalStore().uintValue;
    }
}
