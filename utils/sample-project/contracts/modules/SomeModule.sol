//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/GlobalStorage.sol";
import "../interfaces/ISomeModule.sol";

contract SomeModule is GlobalStorage, ISomeModule {
    event ValueSet(uint256 value);

    function setValue(uint256 newValue) public override {
        _globalStore().value = newValue;
        emit ValueSet(newValue);
    }

    function setSomeValue(uint256 newSomeValue) public override {
        _globalStore().someValue = newSomeValue;
        emit ValueSet(newSomeValue);
    }

    function getValue() public view override returns (uint256) {
        return _globalStore().value;
    }

    function getSomeValue() public view override returns (uint256) {
        return _globalStore().someValue;
    }
}
