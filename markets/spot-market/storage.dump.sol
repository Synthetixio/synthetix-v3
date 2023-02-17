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
        uint256 interestRate;
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
        STALENESS_CIRCUIT_BREAKER
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

// @custom:artifact contracts/interfaces/external/IPythVerifier.sol:IPythVerifier
interface IPythVerifier {
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

// @custom:artifact contracts/modules/AsyncOrderModule.sol:AsyncOrderModule
contract AsyncOrderModule {
    int256 public constant PRECISION = 18;
}

// @custom:artifact contracts/modules/SpotMarketFactoryModule.sol:SpotMarketFactoryModule
contract SpotMarketFactoryModule {
    bytes32 private constant _CREATE_SYNTH_FEATURE_FLAG = "createSynth";
}

// @custom:artifact contracts/storage/AsyncOrder.sol:AsyncOrder
library AsyncOrder {
    struct Data {
        uint256 totalEscrowedSynthShares;
        int256 totalCommittedUsdAmount;
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
        SpotMarketFactory.TransactionType orderType;
        uint256 amountEscrowed;
        uint256 settlementStrategyId;
        uint256 settlementTime;
        int256 committedAmountUsd;
        uint256 minimumSettlementAmount;
        uint256 commitmentBlockNum;
        uint256 settledAt;
    }
    function load(uint128 marketId, uint256 claimId) internal pure returns (Data storage store) {
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

// @custom:artifact contracts/storage/FeeConfiguration.sol:FeeConfiguration
library FeeConfiguration {
    struct Data {
        mapping(address => uint) atomicFixedFeeOverrides;
        uint atomicFixedFee;
        uint asyncFixedFee;
        uint utilizationFeeRate;
        int wrapFixedFee;
        int unwrapFixedFee;
        uint skewScale;
        address feeCollector;
    }
    function load(uint128 marketId) internal pure returns (Data storage feeConfiguration) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            feeConfiguration.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Price.sol:Price
library Price {
    struct Data {
        bytes32 buyFeedId;
        bytes32 sellFeedId;
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
        CHAINLINK,
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
        bool disabled;
    }
}

// @custom:artifact contracts/storage/SpotMarketFactory.sol:SpotMarketFactory
library SpotMarketFactory {
    bytes32 private constant _SLOT_SPOT_MARKET_FACTORY = keccak256(abi.encode("io.synthetix.spot-market.SpotMarketFactory"));
    enum TransactionType {
        BUY,
        SELL,
        ASYNC_BUY,
        ASYNC_SELL,
        WRAP,
        UNWRAP
    }
    struct Data {
        address usdToken;
        address oracle;
        address synthetix;
        address initialSynthImplementation;
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
