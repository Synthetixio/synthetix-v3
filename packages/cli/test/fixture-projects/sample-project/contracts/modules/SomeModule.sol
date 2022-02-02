//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/GlobalStorage.sol";
import "../interfaces/ISomeModule.sol";

contract SomeModule is GlobalStorage, ISomeModule {
    event UintValueSet(address sender, uint value);

    function setUintValue(uint newValue) public override {
        _globalStore().uintValue = newValue;

        emit UintValueSet(msg.sender, newValue);
    }

    function getUintValue() public view override returns (uint) {
        return _globalStore().uintValue;
    }
}
