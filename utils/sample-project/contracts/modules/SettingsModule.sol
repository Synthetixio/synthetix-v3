//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../storage/SettingsStorage.sol";
import "../interfaces/ISettingsModule.sol";

contract SettingsModule is SettingsStorage, ISettingsModule {
    function setASettingValue(uint newSettingValue) public payable override {
        OwnableStorage.onlyOwner();
        _settingsStore().aSettingValue = newSettingValue;
    }

    function getASettingValue() public view override returns (uint) {
        return _settingsStore().aSettingValue;
    }
}
