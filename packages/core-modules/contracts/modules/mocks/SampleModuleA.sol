//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/SampleStorage.sol";
import "../../interfaces/ISampleModuleA.sol";

contract SampleModuleA is SampleStorage, ISampleModuleA {
    error WrongValue();

    function setSomeValue(uint newSomeValue) public override {
        if (newSomeValue == 13) {
            revert WrongValue();
        }

        _sampleStore().someValue = newSomeValue;
    }

    function getSomeValue() public view override returns (uint) {
        return _sampleStore().someValue;
    }
}
