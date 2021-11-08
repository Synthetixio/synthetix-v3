//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../storage/SettingsStorage.sol";

contract SettingsModule is SettingsStorage, OwnableMixin {
    function setASettingValue(uint newSettingValue) public onlyOwner {
        _settingsStore()().aSettingValue = newSettingValue;
    }

    function getASettingValue() public view returns (uint) {
        return _settingsStore()().aSettingValue;
    }
}
