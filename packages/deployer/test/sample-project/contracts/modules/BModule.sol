//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "../storage/GlobalStorage.sol";


contract BModule is GlobalStorageNamespace {
    /* MUTATIVE FUNCTIONS */

    function setValue(uint newValue) public {
        _globalStorage().value = newValue;
    }

    /* VIEW FUNCTIONS */

    function getValue() public view returns (uint) {
        return _globalStorage().value;
    }
}
