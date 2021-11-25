//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/SampleStorage.sol";

contract SampleModuleA is SampleStorage {
    error WrongValue();

    function setSomeValue(uint newSomeValue) public {
        if (newSomeValue == 13) {
            revert WrongValue();
        }

        _sampleStore().someValue = newSomeValue;
    }

    function getSomeValue() public view returns (uint) {
        return _sampleStore().someValue;
    }
}
