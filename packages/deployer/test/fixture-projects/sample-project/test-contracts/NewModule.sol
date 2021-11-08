//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/GlobalStorage.sol";

contract NewModule is GlobalStorage {
    function setSomeNewValue(uint newValue) public {
        _globalStore()().someValue = newValue;
    }
}
