//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/GlobalStorage.sol";

contract AnotherModule is GlobalStorage {
    function getValue() public view returns (uint) {
        return _globalStore().value;
    }

    function getNestedValue(uint index) public view returns (uint) {
        return _globalStore().nestedValue[index].value;
    }
}
