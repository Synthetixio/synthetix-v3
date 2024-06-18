//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ISampleOwnedModule {
    function setProtectedValue(uint256 newProtectedValue) external payable;

    function getProtectedValue() external view returns (uint256);
}
