// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.11<0.9.0;

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

// @custom:artifact contracts/Router.sol:Router
contract Router {
    address private constant _ANOTHER_MODULE = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address private constant _INITIALIZABLE_MODULE = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address private constant _OWNER_MODULE = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
    address private constant _SETTINGS_MODULE = 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9;
    address private constant _SOME_MODULE = 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9;
    address private constant _UPGRADE_MODULE = 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707;
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
