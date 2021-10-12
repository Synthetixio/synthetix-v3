//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract SettingsStorage {
    struct SettingsNamespace {
        uint aSettingValue;
    }

    function _settingsStorage() internal pure returns (SettingsNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.settings")) - 1)
            store.slot := 0x64b748fbda347b7e22c5029a23b4e647df311daee8f2a42947ab7ccf61af2e87
        }
    }
}
