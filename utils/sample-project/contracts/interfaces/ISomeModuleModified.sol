//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ISomeModuleModified {
    function setValue(uint256 newValue) external;

    function setSomeValue(uint256 newSomeValue) external;

    function getValue() external view returns (uint256);

    function getSomeValue() external view returns (uint256);

    function fourtyTwo() external pure returns (uint256);
}
