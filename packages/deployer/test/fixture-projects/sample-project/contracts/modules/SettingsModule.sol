//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/mixins/OwnerMixin.sol";
import "../storage/SettingsStorage.sol";

contract SettingsModule is SettingsStorage, OwnerMixin {
    function setASettingValue(uint newSettingValue) public onlyOwner {
        _settingsStorage().aSettingValue = newSettingValue;
    }

    function getASettingValue() public view returns (uint) {
        return _settingsStorage().aSettingValue;
    }
}
