//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../interfaces/IBothModules.sol";

contract AnotherModule is IAnotherModule {
    function getValue() public pure override returns (uint) {
        return 64;
    }
}

contract SomeModule is ISomeModule {
    function getAnotherValue() public pure override returns (uint) {
        return 42;
    }
}
