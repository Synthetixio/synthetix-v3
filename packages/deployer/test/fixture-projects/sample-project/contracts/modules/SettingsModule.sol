//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/SettingsNamespace.sol";
import "../mixins/OwnerModuleMixin.sol";

contract SettingsModule is SettingsNamespace, OwnerModuleMixin {
    function setASettingValue(uint newSettingValue) public onlyOwner {
        _settingsStorage().aSettingValue = newSettingValue;
    }

    function getASettingValue() public view returns (uint) {
        return _settingsStorage().aSettingValue;
    }
}
