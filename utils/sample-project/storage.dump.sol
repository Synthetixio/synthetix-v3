// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.11<0.9.0;

// @custom:artifact @synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol:OwnableStorage
library OwnableStorage {
    bytes32 private constant _SLOT_OWNABLE_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.Ownable"));
    struct Data {
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

// @custom:artifact @synthetixio/core-contracts/contracts/utils/ERC2771Context.sol:ERC2771Context
library ERC2771Context {
    address private constant TRUSTED_FORWARDER = 0xE2C5658cC5C448B48141168f3e475dF8f65A1e3e;
}

// @custom:artifact contracts/modules/AnotherModule.sol:AnotherModule
contract AnotherModule {
    uint256 private constant _SIXTY_FOUR = 64;
}

// @custom:artifact contracts/storage/GlobalStorage.sol:GlobalStorage
contract GlobalStorage {
    bytes32 private constant _SLOT_GLOBAL_STORAGE = keccak256(abi.encode("io.synthetix.sample-project.Global"));
    struct GlobalStore {
        uint256 value;
        uint256 someValue;
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
        uint256 aSettingValue;
    }
    function _settingsStore() internal pure returns (SettingsStore storage store) {
        bytes32 s = _SLOT_SETTINGS_STORAGE;
        assembly {
            store.slot := s
        }
    }
}
