//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IPrimaryModule {
    function getNumber() external pure returns (uint);
}
