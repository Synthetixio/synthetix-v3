//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ISettingsModule {
    function getASettingValue() external view returns (uint);

    function setASettingValue(uint newSettingValue) external;
}
