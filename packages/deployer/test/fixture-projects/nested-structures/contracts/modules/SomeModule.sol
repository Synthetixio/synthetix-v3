//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/GlobalStorage.sol";

contract SomeModule is GlobalStorage {
    function setValue(uint newValue) public {
        _globalStore().value = newValue;
    }

    function setNestedValue(uint index, uint newValue) public {
        _globalStore().nestedValue[index].value = newValue;
    }
}
