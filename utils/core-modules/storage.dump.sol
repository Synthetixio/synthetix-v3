// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22<0.9.0;

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

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC20Storage.sol:ERC20Storage
library ERC20Storage {
    struct Data {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => uint256) balanceOf;
        mapping(address => mapping(address => uint256)) allowance;
        uint256 totalSupply;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC20"));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC721EnumerableStorage.sol:ERC721EnumerableStorage
library ERC721EnumerableStorage {
    struct Data {
        mapping(uint256 => uint256) ownedTokensIndex;
        mapping(uint256 => uint256) allTokensIndex;
        mapping(address => mapping(uint256 => uint256)) ownedTokens;
        uint256[] allTokens;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC721Enumerable"));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC721Storage.sol:ERC721Storage
library ERC721Storage {
    struct Data {
        string name;
        string symbol;
        string baseTokenURI;
        mapping(uint256 => address) ownerOf;
        mapping(address => uint256) balanceOf;
        mapping(uint256 => address) tokenApprovals;
        mapping(address => mapping(address => bool)) operatorApprovals;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC721"));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/utils/SetUtil.sol:SetUtil
library SetUtil {
    struct UintSet {
        Bytes32Set raw;
    }
    struct AddressSet {
        Bytes32Set raw;
    }
    struct Bytes32Set {
        bytes32[] _values;
        mapping(bytes32 => uint) _positions;
    }
}

// @custom:artifact contracts/storage/AssociatedSystem.sol:AssociatedSystem
library AssociatedSystem {
    struct Data {
        address proxy;
        address impl;
        bytes32 kind;
    }
    function load(bytes32 id) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("AssociatedSystem", id));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/FeatureFlag.sol:FeatureFlag
library FeatureFlag {
    struct Data {
        bytes32 name;
        bool allowAll;
        SetUtil.AddressSet permissionedAddresses;
    }
    function load(bytes32 featureName) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("FeatureFlag", featureName));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Initialized.sol:Initialized
library Initialized {
    struct Data {
        bool initialized;
    }
    function load(bytes32 id) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Initialized", id));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/SampleStorage.sol:SampleStorage
library SampleStorage {
    struct Data {
        uint someValue;
        uint protectedValue;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Sample"));
        assembly {
            store.slot := s
        }
    }
}
