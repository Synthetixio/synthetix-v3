// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

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

// @custom:artifact contracts/interfaces/external/IPyth.sol:PythStructs
contract PythStructs {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint publishTime;
    }
    struct PriceFeed {
        bytes32 id;
        Price price;
        Price emaPrice;
    }
}

// @custom:artifact contracts/storage/Node.sol:Node
library Node {
    struct Data {
        int256 price;
        uint timestamp;
        uint volatilityScore;
        uint liquidityScore;
    }
}

// @custom:artifact contracts/storage/NodeDefinition.sol:NodeDefinition
library NodeDefinition {
    enum NodeType {
        NONE,
        REDUCER,
        EXTERNAL,
        CHAINLINK,
        PYTH,
        PriceDeviationCircuitBreaker,
        UNISWAP,
        StalenessFallbackReducer
    }
    struct Data {
        bytes32[] parents;
        NodeType nodeType;
        bytes parameters;
    }
    function load(bytes32 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("io.synthetix.oracle-manager.Node", id));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/utils/ChainlinkNodeLibrary.sol:ChainlinkNodeLibrary
library ChainlinkNodeLibrary {
    uint256 public constant PRECISION = 18;
}

// @custom:artifact contracts/utils/ReducerNodeLibrary.sol:ReducerNodeLibrary
library ReducerNodeLibrary {
    enum Operations {
        MAX,
        MIN,
        MEAN,
        MEDIAN,
        RECENT
    }
}

// @custom:artifact contracts/utils/TickMath.sol:TickMath
library TickMath {
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = -MIN_TICK;
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;
}
