//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/SettingsNamespace.sol";
import "../mixins/OwnerMixin.sol";

contract SettingsModule is SettingsNamespace, OwnerMixin {
    /* MUTATIVE FUNCTIONS */

    function setASettingValue(uint newSettingValue) public onlyOwner {
        _settingsStorage().aSettingValue = newSettingValue;
    }

    /* VIEW FUNCTIONS */

    function getASettingValue() public view returns (uint) {
        return _settingsStorage().aSettingValue;
    }
}
