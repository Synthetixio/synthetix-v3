//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/GlobalStorage.sol";

contract SomeModuleMock is GlobalStorage {
    error WrongValue();

    function setSomeValue(uint newSomeValue) public {
        if (newSomeValue == 13) {
            revert WrongValue();
        }

        _globalStore().someValue = newSomeValue;
    }

    function getSomeValue() public view returns (uint) {
        return _globalStore().someValue;
    }
}
