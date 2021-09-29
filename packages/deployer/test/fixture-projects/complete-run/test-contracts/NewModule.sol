//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/GlobalNamespace.sol";

contract NewModule is GlobalNamespace {
    function setSomeValue(uint newValue) public {
        _globalStorage().someValue = newValue;
    }
}
