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

// @custom:artifact @synthetixio/core-modules/contracts/storage/AssociatedSystem.sol:AssociatedSystem
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

// @custom:artifact @synthetixio/core-modules/contracts/storage/Initialized.sol:Initialized
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

// @custom:artifact @synthetixio/oracle-manager/contracts/storage/Node.sol:Node
library Node {
    struct Data {
        int256 price;
        uint timestamp;
        uint volatilityScore;
        uint liquidityScore;
    }
}

// @custom:artifact @synthetixio/oracle-manager/contracts/storage/NodeDefinition.sol:NodeDefinition
library NodeDefinition {
    enum NodeType {
        NONE,
        REDUCER,
        EXTERNAL,
        CHAINLINK,
        PYTH
    }
    struct Data {
        bytes32[] parents;
        NodeType nodeType;
        bytes parameters;
    }
    function load(bytes32 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Node", id));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Fee.sol:Fee
library Fee {
    enum TransactionType {
        BUY,
        SELL,
        WRAP,
        UNWRAP
    }
    struct Data {
        uint atomicFixedFee;
        uint skewScale;
        uint utilizationFeeRate;
        uint wrapperFee;
    }
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Fee", marketId));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Price.sol:Price
library Price {
    struct Data {
        bytes32 buyFeedId;
        bytes32 sellFeedId;
    }
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Price", marketId));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/SpotMarketFactory.sol:SpotMarketFactory
library SpotMarketFactory {
    struct Data {
        address usdToken;
        address oracle;
        address synthetix;
        address initialSynthImplementation;
        mapping(uint128 => address) synthOwners;
        mapping(uint128 => uint256) synthFeesCollected;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("SpotMarketFactory"));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Wrapper.sol:Wrapper
library Wrapper {
    struct Data {
        address collateralType;
        bool wrappingEnabled;
    }
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Wrapper", marketId));
        assembly {
            store.slot := s
        }
    }
}
