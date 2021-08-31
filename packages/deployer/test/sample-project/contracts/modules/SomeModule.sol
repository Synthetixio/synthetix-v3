//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/GlobalNamespace.sol";

contract SomeModule is GlobalNamespace {
    /* MUTATIVE FUNCTIONS */

    function setValue(uint newValue) public {
        _globalStorage().value = newValue;
    }

    function setSomeValue(uint newSomeValue) public {
        _globalStorage().someValue = newSomeValue;
    }

    /* VIEW FUNCTIONS */

    function getValue() public view returns (uint) {
        return _globalStorage().value;
    }

    function getSomeValue() public view returns (uint) {
        return _globalStorage().someValue;
    }
}
