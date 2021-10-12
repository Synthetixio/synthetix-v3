//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/SettingsStorage.sol";
import "../mixins/OwnerMixin.sol";

contract SettingsModule is SettingsStorage, OwnerMixin {
    function setASettingValue(uint newSettingValue) public onlyOwner {
        _settingsStorage().aSettingValue = newSettingValue;
    }

    function getASettingValue() public view returns (uint) {
        return _settingsStorage().aSettingValue;
    }
}
