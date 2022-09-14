//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISomeModule {
    function setUintValue(uint newValue) external;

    function getUintValue() external view returns (uint);

    function setAddressArray(address[] calldata addresses) external;

    function getAddressArray() external view returns (address[] memory);
}
