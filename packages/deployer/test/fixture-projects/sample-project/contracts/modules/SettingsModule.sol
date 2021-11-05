//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../storage/SettingsStorage.sol";

contract SettingsModule is SettingsStorage, OwnableMixin {
    function setASettingValue(uint newSettingValue) public onlyOwner {
        _settingsStorage().aSettingValue = newSettingValue;
    }

    function getASettingValue() public view returns (uint) {
        return _settingsStorage().aSettingValue;
    }
}
