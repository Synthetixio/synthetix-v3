//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "../storage/GlobalStorage.sol";
import "../interfaces/ISomeModule.sol";

contract SomeModule is GlobalStorage, ISomeModule {
    event ValueSet(address sender, uint value);

    function setValue(uint newValue) public override {
        _globalStore().value = newValue;

        emit ValueSet(ERC2771Context._msgSender(), newValue);
    }

    function setSomeValue(uint newSomeValue) public override {
        _globalStore().someValue = newSomeValue;

        emit ValueSet(ERC2771Context._msgSender(), newSomeValue);
    }

    function getValue() public view override returns (uint) {
        return _globalStore().value;
    }

    function getSomeValue() public view override returns (uint) {
        return _globalStore().someValue;
    }
}
