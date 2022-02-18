//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/AnotherModuleStorage.sol";
import "../interfaces/IAnotherModule.sol";

contract AnotherModule is AnotherModuleStorage, IAnotherModule {
    function getAnotherValue() public view override returns (uint) {
        return _anotherModuleStore().theValue;
    }
}
