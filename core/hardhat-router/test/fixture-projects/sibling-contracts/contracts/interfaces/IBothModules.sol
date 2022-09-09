//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IAnotherModule {
    function getValue() external pure returns (uint);
}

interface ISomeModule {
    function getAnotherValue() external pure returns (uint);
}
