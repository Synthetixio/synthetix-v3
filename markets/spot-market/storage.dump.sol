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

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC721EnumerableStorage.sol:ERC721EnumerableStorage
library ERC721EnumerableStorage {
    bytes32 private constant _SLOT_ERC721_ENUMERABLE_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.ERC721Enumerable"));
    struct Data {
        mapping(uint256 => uint256) ownedTokensIndex;
        mapping(uint256 => uint256) allTokensIndex;
        mapping(address => mapping(uint256 => uint256)) ownedTokens;
        uint256[] allTokens;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_ERC721_ENUMERABLE_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC721Storage.sol:ERC721Storage
library ERC721Storage {
    bytes32 private constant _SLOT_ERC721_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.ERC721"));
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
        bytes32 s = _SLOT_ERC721_STORAGE;
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

// @custom:artifact @synthetixio/core-modules/contracts/modules/NftModule.sol:NftModule
contract NftModule {
    bytes32 internal constant _INITIALIZED_NAME = "NftModule";
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
        SetUtil.AddressSet permissionedAddresses;
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
    function load(bytes32 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("io.synthetix.oracle-manager.Node", id));
        assembly {
            data.slot := s
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

// @custom:artifact contracts/modules/SpotMarketFactoryModule.sol:SpotMarketFactoryModule
contract SpotMarketFactoryModule {
    bytes32 private constant _CREATE_SYNTH_FEATURE_FLAG = "createSynth";
}

// @custom:artifact contracts/storage/AsyncOrderClaim.sol:AsyncOrderClaim
library AsyncOrderClaim {
    struct Data {
        SpotMarketFactory.TransactionType orderType;
        uint256 amountEscrowed;
        uint256 settlementStrategyId;
        uint256 settlementTime;
        int256 utilizationDelta;
        uint256 cancellationFee;
    }
}

// @custom:artifact contracts/storage/AsyncOrderConfiguration.sol:AsyncOrderConfiguration
library AsyncOrderConfiguration {
    enum SettlementStrategyType {
        ONCHAIN,
        CHAINLINK,
        PYTH
    }
    struct Data {
        mapping(uint256 => AsyncOrderClaim.Data) asyncOrderClaims;
        mapping(address => uint256) escrowedSynthShares;
        uint256 totalEscrowedSynthShares;
        SettlementStrategy[] settlementStrategies;
        int256 asyncUtilizationDelta;
    }
    struct SettlementStrategy {
        SettlementStrategyType strategyType;
        uint256 fixedFee;
        uint256 settlementDelay;
        uint256 settlementWindowDuration;
        address priceVerificationContract;
    }
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.AsyncOrder", marketId));
        assembly {
            store.slot := s
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
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
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
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Price", marketId));
        assembly {
            store.slot := s
        }
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
        address initialAsyncOrderClaimImplementation;
        mapping(uint128 => address) marketOwners;
        mapping(uint128 => address) nominatedMarketOwners;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_SPOT_MARKET_FACTORY;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Wrapper.sol:Wrapper
library Wrapper {
    struct Data {
        address wrapCollateralType;
        uint256 maxWrappableAmount;
    }
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Wrapper", marketId));
        assembly {
            store.slot := s
        }
    }
}
