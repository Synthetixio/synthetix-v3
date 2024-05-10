// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.11<0.9.0;

// @custom:artifact @synthetixio/core-contracts/contracts/utils/DecimalMath.sol:DecimalMath
library DecimalMath {
    uint256 public constant UNIT = 1e18;
    int256 public constant UNIT_INT = int256(UNIT);
    uint128 public constant UNIT_UINT128 = uint128(UNIT);
    int128 public constant UNIT_INT128 = int128(UNIT_INT);
    uint256 public constant UNIT_PRECISE = 1e27;
    int256 public constant UNIT_PRECISE_INT = int256(UNIT_PRECISE);
    int128 public constant UNIT_PRECISE_INT128 = int128(UNIT_PRECISE_INT);
    uint256 public constant PRECISION_FACTOR = 9;
}

// @custom:artifact @synthetixio/core-contracts/contracts/utils/ERC2771Context.sol:ERC2771Context
library ERC2771Context {
    address private constant TRUSTED_FORWARDER = 0xE2C5658cC5C448B48141168f3e475dF8f65A1e3e;
}

// @custom:artifact @synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol:PythStructs
contract PythStructs {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
    struct PriceFeed {
        bytes32 id;
        Price price;
        Price emaPrice;
    }
}

// @custom:artifact @synthetixio/oracle-manager/contracts/nodes/ChainlinkNode.sol:ChainlinkNode
library ChainlinkNode {
    uint256 public constant PRECISION = 18;
}

// @custom:artifact @synthetixio/oracle-manager/contracts/nodes/ReducerNode.sol:ReducerNode
library ReducerNode {
    enum Operations {
        RECENT,
        MIN,
        MAX,
        MEAN,
        MEDIAN,
        MUL,
        DIV,
        MULDECIMAL,
        DIVDECIMAL
    }
}

// @custom:artifact @synthetixio/oracle-manager/contracts/nodes/UniswapNode.sol:UniswapNode
library UniswapNode {
    uint8 public constant PRECISION = 18;
}

// @custom:artifact @synthetixio/oracle-manager/contracts/nodes/pyth/PythNode.sol:PythNode
library PythNode {
    int256 public constant PRECISION = 18;
}

// @custom:artifact @synthetixio/oracle-manager/contracts/nodes/pyth/PythOffchainLookupNode.sol:PythOffchainLookupNode
library PythOffchainLookupNode {
    int256 public constant PRECISION = 18;
}

// @custom:artifact @synthetixio/oracle-manager/contracts/storage/NodeDefinition.sol:NodeDefinition
library NodeDefinition {
    enum NodeType {
        NONE,
        REDUCER,
        EXTERNAL,
        CHAINLINK,
        UNISWAP,
        PYTH,
        PRICE_DEVIATION_CIRCUIT_BREAKER,
        STALENESS_CIRCUIT_BREAKER,
        CONSTANT,
        PYTH_OFFCHAIN_LOOKUP
    }
    struct Data {
        NodeType nodeType;
        bytes parameters;
        bytes32[] parents;
    }
    function load(bytes32 id) internal pure returns (Data storage node) {
        bytes32 s = keccak256(abi.encode("io.synthetix.oracle-manager.Node", id));
        assembly {
            node.slot := s
        }
    }
}

// @custom:artifact @synthetixio/oracle-manager/contracts/storage/NodeOutput.sol:NodeOutput
library NodeOutput {
    struct Data {
        int256 price;
        uint256 timestamp;
        uint256 __slotAvailableForFutureUse1;
        uint256 __slotAvailableForFutureUse2;
    }
}

// @custom:artifact @synthetixio/oracle-manager/contracts/utils/TickMath.sol:TickMath
library TickMath {
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = -MIN_TICK;
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;
}

// @custom:artifact @synthetixio/spot-market/contracts/storage/OrderFees.sol:OrderFees
library OrderFees {
    struct Data {
        uint256 fixedFees;
        uint256 utilizationFees;
        int256 skewFees;
        int256 wrapperFees;
    }
}

// @custom:artifact @synthetixio/spot-market/contracts/storage/Price.sol:Price
library Price {
    enum Tolerance {
        DEFAULT,
        STRICT
    }
    struct Data {
        bytes32 buyFeedId;
        bytes32 sellFeedId;
        uint256 strictStalenessTolerance;
    }
    function load(uint128 marketId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Price", marketId));
        assembly {
            price.slot := s
        }
    }
}

// @custom:artifact @synthetixio/spot-market/contracts/storage/SpotMarketFactory.sol:SpotMarketFactory
library SpotMarketFactory {
    bytes32 private constant _SLOT_SPOT_MARKET_FACTORY = keccak256(abi.encode("io.synthetix.spot-market.SpotMarketFactory"));
    struct Data {
        address usdToken;
        address oracle;
        address synthetix;
        address synthImplementation;
        mapping(uint128 => address) marketOwners;
        mapping(uint128 => address) nominatedMarketOwners;
    }
    function load() internal pure returns (Data storage spotMarketFactory) {
        bytes32 s = _SLOT_SPOT_MARKET_FACTORY;
        assembly {
            spotMarketFactory.slot := s
        }
    }
}

// @custom:artifact @synthetixio/spot-market/contracts/utils/TransactionUtil.sol:Transaction
library Transaction {
    enum Type {
        NULL,
        BUY,
        SELL,
        ASYNC_BUY,
        ASYNC_SELL,
        WRAP,
        UNWRAP
    }
}

// @custom:artifact contracts/SpotMarketOracle.sol:SpotMarketOracle
contract SpotMarketOracle {
    int256 public constant PRECISION = 18;
}
