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

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC20Storage.sol:ERC20Storage
library ERC20Storage {
    bytes32 private constant _SLOT_ERC20_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.ERC20"));
    struct Data {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => uint256) balanceOf;
        mapping(address => mapping(address => uint256)) allowance;
        uint256 totalSupply;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_ERC20_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

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
        mapping(bytes32 => uint256) _positions;
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/modules/DecayTokenModule.sol:DecayTokenModule
contract DecayTokenModule {
    uint256 private constant SECONDS_PER_YEAR = 31536000;
}

// @custom:artifact @synthetixio/core-modules/contracts/modules/TokenModule.sol:TokenModule
contract TokenModule {
    bytes32 internal constant _INITIALIZED_NAME = "TokenModule";
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/AssociatedSystem.sol:AssociatedSystem
library AssociatedSystem {
    bytes32 public constant KIND_ERC20 = "erc20";
    bytes32 public constant KIND_ERC721 = "erc721";
    bytes32 public constant KIND_UNMANAGED = "unmanaged";
    struct Data {
        address proxy;
        address impl;
        bytes32 kind;
    }
    function load(bytes32 id) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.core-modules.AssociatedSystem", id));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/DecayToken.sol:DecayToken
library DecayToken {
    bytes32 private constant _SLOT_DECAY_TOKEN_STORAGE = keccak256(abi.encode("io.synthetix.core-modules.DecayToken"));
    struct Data {
        uint256 decayRate;
        uint256 epochStart;
        uint256 totalSupplyAtEpochStart;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_DECAY_TOKEN_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/FeatureFlag.sol:FeatureFlag
library FeatureFlag {
    struct Data {
        bytes32 name;
        bool allowAll;
        bool denyAll;
        SetUtil.AddressSet permissionedAddresses;
        address[] deniers;
    }
    function load(bytes32 featureName) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.core-modules.FeatureFlag", featureName));
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
        bytes32 s = keccak256(abi.encode("io.synthetix.code-modules.Initialized", id));
        assembly {
            store.slot := s
        }
    }
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

// @custom:artifact contracts/modules/SpotMarketFactoryModule.sol:SpotMarketFactoryModule
contract SpotMarketFactoryModule {
    bytes32 private constant _CREATE_SYNTH_FEATURE_FLAG = "createSynth";
    uint8 private constant _SYNTH_IMPLEMENTATION_DECIMALS = 18;
}

// @custom:artifact contracts/storage/AsyncOrder.sol:AsyncOrder
library AsyncOrder {
    struct Data {
        uint256 totalEscrowedSynthShares;
        uint128 totalClaims;
    }
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.AsyncOrder", marketId));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/AsyncOrderClaim.sol:AsyncOrderClaim
library AsyncOrderClaim {
    struct Data {
        uint128 id;
        address owner;
        Transaction.Type orderType;
        uint256 amountEscrowed;
        uint256 settlementStrategyId;
        uint256 commitmentTime;
        uint256 minimumSettlementAmount;
        uint256 settledAt;
        address referrer;
    }
    function load(uint128 marketId, uint128 claimId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.AsyncOrderClaim", marketId, claimId));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/AsyncOrderConfiguration.sol:AsyncOrderConfiguration
library AsyncOrderConfiguration {
    struct Data {
        SettlementStrategy.Data[] settlementStrategies;
    }
    function load(uint128 marketId) internal pure returns (Data storage asyncOrderConfiguration) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.AsyncOrderConfiguration", marketId));
        assembly {
            asyncOrderConfiguration.slot := s
        }
    }
}

// @custom:artifact contracts/storage/MarketConfiguration.sol:MarketConfiguration
library MarketConfiguration {
    struct Data {
        mapping(address => uint256) fixedFeeOverrides;
        uint256 atomicFixedFee;
        uint256 asyncFixedFee;
        uint256 utilizationFeeRate;
        uint256 collateralLeverage;
        int256 wrapFixedFee;
        int256 unwrapFixedFee;
        uint256 skewScale;
        address feeCollector;
        mapping(address => uint256) referrerShare;
    }
    function load(uint128 marketId) internal pure returns (Data storage marketConfig) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            marketConfig.slot := s
        }
    }
}

// @custom:artifact contracts/storage/OrderFees.sol:OrderFees
library OrderFees {
    struct Data {
        uint256 fixedFees;
        uint256 utilizationFees;
        int256 skewFees;
        int256 wrapperFees;
    }
}

// @custom:artifact contracts/storage/Price.sol:Price
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

// @custom:artifact contracts/storage/SettlementStrategy.sol:SettlementStrategy
library SettlementStrategy {
    enum Type {
        ONCHAIN,
        PYTH
    }
    struct Data {
        Type strategyType;
        uint256 settlementDelay;
        uint256 settlementWindowDuration;
        address priceVerificationContract;
        bytes32 feedId;
        string url;
        uint256 settlementReward;
        uint256 priceDeviationTolerance;
        uint256 minimumUsdExchangeAmount;
        uint256 maxRoundingLoss;
        bool disabled;
    }
}

// @custom:artifact contracts/storage/SpotMarketFactory.sol:SpotMarketFactory
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

// @custom:artifact contracts/storage/Wrapper.sol:Wrapper
library Wrapper {
    struct Data {
        address wrapCollateralType;
        uint256 maxWrappableAmount;
    }
    function load(uint128 marketId) internal pure returns (Data storage wrapper) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Wrapper", marketId));
        assembly {
            wrapper.slot := s
        }
    }
}

// @custom:artifact contracts/utils/TransactionUtil.sol:Transaction
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
