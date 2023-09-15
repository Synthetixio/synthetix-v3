//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ISomeModuleModified {
    function setValue(uint newValue) external;

    function setSomeValue(uint newSomeValue) external;

    function getValue() external view returns (uint);

    function getSomeValue() external view returns (uint);

    function fourtyTwo() external pure returns (uint);
}
