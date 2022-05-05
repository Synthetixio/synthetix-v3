//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../interfaces/ISomeModule2.sol";

contract SomeModule is ISomeModule2 {
    function getYetAnotherValue() public pure override returns (uint) {
        return 42;
    }
}
