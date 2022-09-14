//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/SomeModuleStorage.sol";
import "../interfaces/ISomeModule.sol";

contract SomeModule is SomeModuleStorage, ISomeModule {
    function getSomeValue() public view override returns (uint) {
        return _someModuleStore().theValue;
    }
}
