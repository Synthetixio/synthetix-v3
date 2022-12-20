// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// @custom:artifact @synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol:OwnableStorage
library OwnableStorage {
    bytes32 private constant _SLOT_OWNABLE_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.Ownable"));
    struct Data {
        bool initialized;
        address owner;
        address nominatedOwner;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_OWNABLE_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/proxy/ProxyStorage.sol:ProxyStorage
contract ProxyStorage {
    bytes32 private constant _SLOT_PROXY_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.Proxy"));
    struct ProxyStore {
        address implementation;
        bool simulatingUpgrade;
    }
    function _proxyStore() internal pure returns (ProxyStore storage store) {
        bytes32 s = _SLOT_PROXY_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/modules/AnotherModule.sol:AnotherModule
contract AnotherModule {
    uint private constant _SIXTY_FOUR = 64;
}

// @custom:artifact contracts/storage/GlobalStorage.sol:GlobalStorage
contract GlobalStorage {
    bytes32 private constant _SLOT_GLOBAL_STORAGE = keccak256(abi.encode("io.synthetix.sample-project.Global"));
    struct GlobalStore {
        uint value;
        uint someValue;
    }
    function _globalStore() internal pure returns (GlobalStore storage store) {
        bytes32 s = _SLOT_GLOBAL_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/InitializableStorage.sol:InitializableStorage
contract InitializableStorage {
    bytes32 private constant _SLOT_INITIALIZABLE_STORAGE = keccak256(abi.encode("io.synthetix.sample-project.Initializable"));
    struct InitializableStore {
        bool initialized;
    }
    function _initializableStore() internal pure returns (InitializableStore storage store) {
        bytes32 s = _SLOT_INITIALIZABLE_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/SettingsStorage.sol:SettingsStorage
contract SettingsStorage {
    bytes32 private constant _SLOT_SETTINGS_STORAGE = keccak256(abi.encode("io.synthetix.sample-project.Settings"));
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
