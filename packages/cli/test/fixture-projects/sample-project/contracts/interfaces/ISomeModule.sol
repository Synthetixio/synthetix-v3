//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISomeModule {
    function setUintValue(uint newValue) external;

    function getUintValue() external view returns (uint);
}
