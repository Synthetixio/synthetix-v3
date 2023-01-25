//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ISampleFeatureFlagModule {
    function setFeatureFlaggedValue(uint valueToSet) external;

    function getFeatureFlaggedValue() external view returns (uint);
}
