//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SettingsStorage {
    bytes32 private constant _SLOT_SETTINGS_STORAGE =
        keccak256(abi.encode("io.synthetix.sample-project.Settings"));

    struct SettingsStore {
        uint aSettingValue;
    }

    function _settingsStore() internal pure returns (SettingsStore storage store) {
        bytes32 s = _SLOT_SETTINGS_STORAGE;
        assembly {
            store.slot := s
        }
    }
}
