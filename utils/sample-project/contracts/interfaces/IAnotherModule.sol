//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IAnotherModule {
    function getAnotherValue() external pure returns (uint);

    function getAnotherImmutableValue() external pure returns (uint);
}
