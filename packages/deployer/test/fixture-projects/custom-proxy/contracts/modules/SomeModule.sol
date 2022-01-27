//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../interfaces/ISomeModule.sol";

contract SomeModule is ISomeModule {
    function getValue() public pure override returns (uint) {
        return 42;
    }
}
