//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "../storage/SettingsStorage.sol";
import "../mixins/OwnerMixin.sol";


contract SettingsModule is SettingsStorageNamespace, OwnerMixin {
    /* MUTATIVE FUNCTIONS */

    function setMinCollateralRatio(uint newMinCollateralRatio) public onlyOwner {
        _settingsStorage().minCollateralRatio = newMinCollateralRatio;
    }

    /* VIEW FUNCTIONS */

    function getMinCollateralRatio() public view returns (uint) {
        return _settingsStorage().minCollateralRatio;
    }
}
