//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ISomeModule {
    function getValue() external view returns (uint);

    function getSomeValue() external view returns (uint);

    function setValue(uint newValue) external payable;

    function setSomeValue(uint newSomeValue) external payable;
}
