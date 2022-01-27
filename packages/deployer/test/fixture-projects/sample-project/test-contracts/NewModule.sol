//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/GlobalStorage.sol";
import "../interfaces/INewModule.sol";

contract NewModule is GlobalStorage, INewModule {
    function setSomeNewValue(uint newValue) public override {
        _globalStore().someValue = newValue;
    }
}
