//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/SampleStorage.sol";
import "../../interfaces/ISampleModuleA.sol";

contract SampleModuleA is ISampleModuleA {
    error WrongValue();

    function setSomeValue(uint newSomeValue) public override {
        if (newSomeValue == 13) {
            revert WrongValue();
        }

        SampleStorage.load().someValue = newSomeValue;
    }

    function getSomeValue() public view override returns (uint) {
        return SampleStorage.load().someValue;
    }
}
