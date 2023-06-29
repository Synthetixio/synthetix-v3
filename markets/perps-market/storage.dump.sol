// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22<0.9.0;

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
        STALENESS_CIRCUIT_BREAKER,
        CONSTANT
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

// @custom:artifact @synthetixio/spot-market/contracts/storage/OrderFees.sol:OrderFees
library OrderFees {
    struct Data {
        uint256 fixedFees;
        uint256 utilizationFees;
        int256 skewFees;
        int256 wrapperFees;
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
    struct RuntimeCommitData {
        uint feesAccrued;
        AsyncOrder.Status status;
    }
}

// @custom:artifact contracts/modules/PerpsMarketFactoryModule.sol:PerpsMarketFactoryModule
contract PerpsMarketFactoryModule {
    bytes32 private constant _CREATE_MARKET_FEATURE_FLAG = "createMarket";
    bytes32 private constant _ACCOUNT_TOKEN_SYSTEM = "accountNft";
}

// @custom:artifact contracts/storage/AsyncOrder.sol:AsyncOrder
library AsyncOrder {
    enum Status {
        Success,
        PriceOutOfBounds,
        CanLiquidate,
        MaxMarketValueExceeded,
        MaxLeverageExceeded,
        InsufficientMargin,
        NotPermitted,
        ZeroSizeOrder,
        AcceptablePriceExceeded,
        PositionFlagged
    }
    struct Data {
        uint128 accountId;
        uint128 marketId;
        int256 sizeDelta;
        uint256 settlementStrategyId;
        uint256 settlementTime;
        uint256 acceptablePrice;
        bytes32 trackingCode;
    }
    struct OrderCommitmentRequest {
        uint128 marketId;
        uint128 accountId;
        int256 sizeDelta;
        uint256 settlementStrategyId;
        uint256 acceptablePrice;
        bytes32 trackingCode;
    }
    struct SimulateDataRuntime {
        uint fillPrice;
        uint fees;
        uint availableMargin;
        uint currentLiquidationMargin;
        int128 newPositionSize;
        uint newLiquidationMargin;
        Position.Data newPosition;
    }
}

// @custom:artifact contracts/storage/GlobalPerpsMarket.sol:GlobalPerpsMarket
library GlobalPerpsMarket {
    bytes32 private constant _SLOT_GLOBAL_PERPS_MARKET = keccak256(abi.encode("io.synthetix.perps-market.GlobalPerpsMarket"));
    struct Data {
        SetUtil.UintSet liquidatableAccounts;
        mapping(uint128 => uint) collateralAmounts;
    }
    function load() internal pure returns (Data storage marketData) {
        bytes32 s = _SLOT_GLOBAL_PERPS_MARKET;
        assembly {
            marketData.slot := s
        }
    }
}

// @custom:artifact contracts/storage/GlobalPerpsMarketConfiguration.sol:GlobalPerpsMarketConfiguration
library GlobalPerpsMarketConfiguration {
    bytes32 private constant _SLOT_GLOBAL_PERPS_MARKET_CONFIGURATION = keccak256(abi.encode("io.synthetix.perps-market.GlobalPerpsMarketConfiguration"));
    struct Data {
        mapping(uint128 => uint) maxCollateralAmounts;
        uint128[] synthDeductionPriority;
        uint minLiquidationRewardUsd;
        uint maxLiquidationRewardUsd;
    }
    function load() internal pure returns (Data storage globalMarketConfig) {
        bytes32 s = _SLOT_GLOBAL_PERPS_MARKET_CONFIGURATION;
        assembly {
            globalMarketConfig.slot := s
        }
    }
}

// @custom:artifact contracts/storage/LiquidationConfiguration.sol:LiquidationConfiguration
library LiquidationConfiguration {
    struct Data {
        uint liquidationPremiumMultiplier;
        uint maxLiquidationDelta;
        uint maxPremiumDiscount;
        uint minLiquidationRewardUsd;
        uint maxLiquidationRewardUsd;
        uint desiredLiquidationRewardPercentage;
        uint liquidationBufferRatio;
    }
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.LiquidationConfiguration", marketId));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/OrderFee.sol:OrderFee
library OrderFee {
    struct Data {
        uint256 makerFee;
        uint256 takerFee;
    }
}

// @custom:artifact contracts/storage/PerpsAccount.sol:PerpsAccount
library PerpsAccount {
    struct Data {
        mapping(uint128 => uint) collateralAmounts;
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet openPositionMarketIds;
        bool flaggedForLiquidation;
    }
    struct RuntimeLiquidationData {
        uint totalLosingPnl;
        uint totalLiquidationRewards;
        uint losingMarketsLength;
        uint profitableMarketsLength;
        uint128[] profitableMarkets;
        uint128[] losingMarkets;
        uint amountToDeposit;
        uint amountToLiquidatePercentage;
        uint percentageOfTotalLosingPnl;
        uint totalAvailableForDeposit;
    }
    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Account", id));
        assembly {
            account.slot := s
        }
    }
}

// @custom:artifact contracts/storage/PerpsMarket.sol:PerpsMarket
library PerpsMarket {
    struct Data {
        address owner;
        address nominatedOwner;
        string name;
        string symbol;
        uint128 id;
        int256 skew;
        uint256 size;
        int lastFundingRate;
        int lastFundingValue;
        uint256 lastFundingTime;
        uint128 lastTimeLiquidationCapacityUpdated;
        uint128 lastUtilizedLiquidationCapacity;
        mapping(uint => AsyncOrder.Data) asyncOrders;
        mapping(uint => Position.Data) positions;
    }
    function load(uint128 marketId) internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.PerpsMarket", marketId));
        assembly {
            market.slot := s
        }
    }
}

// @custom:artifact contracts/storage/PerpsMarketConfiguration.sol:PerpsMarketConfiguration
library PerpsMarketConfiguration {
    enum OrderType {
        ASYNC_ONCHAIN,
        ASYNC_OFFCHAIN,
        ATOMIC
    }
    struct Data {
        mapping(OrderType => OrderFee.Data) orderFees;
        SettlementStrategy.Data[] settlementStrategies;
        uint256 maxMarketValue;
        uint256 maxFundingVelocity;
        uint256 skewScale;
        uint256 minInitialMargin;
        uint256 liquidationPremiumMultiplier;
        uint256 lockedOiPercent;
        uint256 maxLiquidationLimitAccumulationMultiplier;
        uint liquidationRewardPercentage;
        uint maxLiquidationReward;
    }
    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.PerpsMarketConfiguration", marketId));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/PerpsMarketFactory.sol:PerpsMarketFactory
library PerpsMarketFactory {
    bytes32 private constant _SLOT_PERPS_MARKET_FACTORY = keccak256(abi.encode("io.synthetix.perps-market.PerpsMarketFactory"));
    struct Data {
        address oracle;
        address usdToken;
        address synthetix;
        address spotMarket;
        mapping(uint128 => uint) maxCollateralAmounts;
        uint128[] synthDeductionPriority;
        uint maxLeverage;
        SetUtil.UintSet liquidatableAccounts;
        mapping(uint128 => uint) collateralAmounts;
        mapping(uint128 => address) marketOwners;
    }
    function load() internal pure returns (Data storage perpsMarketFactory) {
        bytes32 s = _SLOT_PERPS_MARKET_FACTORY;
        assembly {
            perpsMarketFactory.slot := s
        }
    }
}

// @custom:artifact contracts/storage/PerpsPrice.sol:PerpsPrice
library PerpsPrice {
    struct Data {
        bytes32 feedId;
    }
    function load(uint128 marketId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Price", marketId));
        assembly {
            price.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Position.sol:Position
library Position {
    struct Data {
        uint128 marketId;
        int128 size;
        uint128 latestInteractionPrice;
        int128 latestInteractionFunding;
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
        bool disabled;
    }
}

// @custom:artifact hardhat/console.sol:console
library console {
    address internal constant CONSOLE_ADDRESS = address(0x000000000000000000636F6e736F6c652e6c6f67);
}
