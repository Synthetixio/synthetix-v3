// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// @custom:artifact @synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol:OwnableStorage
library OwnableStorage {
    struct Data {
        bool initialized;
        address owner;
        address nominatedOwner;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Ownable"));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/proxy/ProxyStorage.sol:ProxyStorage
contract ProxyStorage {
    struct ProxyStore {
        address implementation;
        bool simulatingUpgrade;
    }
    function _proxyStore() internal pure returns (ProxyStore storage store) {
        assembly {
            store.slot := 0x32402780481dd8149e50baad867f01da72e2f7d02639a6fe378dbd80b6bb446e
        }
    }
}

// @custom:artifact contracts/storage/GlobalStorage.sol:GlobalStorage
contract GlobalStorage {
    struct GlobalStore {
        uint value;
        uint someValue;
    }
    function _globalStore() internal pure returns (GlobalStore storage store) {
        assembly {
            store.slot := 0x8f203f5ee9f9a1d361b4a0f56abfdac49cdd246db58538b151edf87309e955b9
        }
    }
}

// @custom:artifact contracts/storage/InitializableStorage.sol:InitializableStorage
contract InitializableStorage {
    struct InitializableStore {
        bool initialized;
    }
    function _initializableStore() internal pure returns (InitializableStore storage store) {
        assembly {
            store.slot := 0xe1550b5a17836cfadda6044cd412df004a72cf007361a046298ac83a7992948c
        }
    }
}

// @custom:artifact contracts/storage/SettingsStorage.sol:SettingsStorage
contract SettingsStorage {
    struct SettingsStore {
        uint aSettingValue;
    }
    function _settingsStore() internal pure returns (SettingsStore storage store) {
        assembly {
            store.slot := 0x64b748fbda347b7e22c5029a23b4e647df311daee8f2a42947ab7ccf61af2e87
        }
    }
}
