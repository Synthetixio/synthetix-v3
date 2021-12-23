//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract AnotherModule {
    function getValue() public pure returns (uint) {
        return 64;
    }
}

contract SomeModule {
    function getAnotherValue() public pure returns (uint) {
        return 42;
    }
}
