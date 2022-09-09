//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISampleModuleA {
    function setSomeValue(uint newSomeValue) external;

    function getSomeValue() external view returns (uint);
}
