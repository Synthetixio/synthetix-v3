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

// @custom:artifact @synthetixio/core-contracts/contracts/utils/HeapUtil.sol:HeapUtil
library HeapUtil {
    uint private constant _ROOT_INDEX = 1;
    struct Data {
        uint128 idCount;
        Node[] nodes;
        mapping(uint128 => uint) indices;
    }
    struct Node {
        uint128 id;
        int128 priority;
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

// @custom:artifact @synthetixio/main/contracts/storage/Account.sol:Account
library Account {
    struct Data {
        uint128 id;
        AccountRBAC.Data rbac;
        uint64 lastInteraction;
        uint64 __slotAvailableForFutureUse;
        uint128 __slot2AvailableForFutureUse;
        mapping(address => Collateral.Data) collaterals;
    }
    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Account", id));
        assembly {
            account.slot := s
        }
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/AccountRBAC.sol:AccountRBAC
library AccountRBAC {
    bytes32 internal constant _ADMIN_PERMISSION = "ADMIN";
    bytes32 internal constant _WITHDRAW_PERMISSION = "WITHDRAW";
    bytes32 internal constant _DELEGATE_PERMISSION = "DELEGATE";
    bytes32 internal constant _MINT_PERMISSION = "MINT";
    bytes32 internal constant _REWARDS_PERMISSION = "REWARDS";
    bytes32 internal constant _PERPS_MODIFY_COLLATERAL_PERMISSION = "PERPS_MODIFY_COLLATERAL";
    struct Data {
        address owner;
        mapping(address => SetUtil.Bytes32Set) permissions;
        SetUtil.AddressSet permissionAddresses;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/Collateral.sol:Collateral
library Collateral {
    struct Data {
        uint256 amountAvailableForDelegationD18;
        SetUtil.UintSet pools;
        CollateralLock.Data[] locks;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/CollateralConfiguration.sol:CollateralConfiguration
library CollateralConfiguration {
    bytes32 private constant _SLOT_AVAILABLE_COLLATERALS = keccak256(abi.encode("io.synthetix.synthetix.CollateralConfiguration_availableCollaterals"));
    struct Data {
        bool depositingEnabled;
        uint256 issuanceRatioD18;
        uint256 liquidationRatioD18;
        uint256 liquidationRewardD18;
        bytes32 oracleNodeId;
        address tokenAddress;
        uint256 minDelegationD18;
    }
    function load(address token) internal pure returns (Data storage collateralConfiguration) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.CollateralConfiguration", token));
        assembly {
            collateralConfiguration.slot := s
        }
    }
    function loadAvailableCollaterals() internal pure returns (SetUtil.AddressSet storage availableCollaterals) {
        bytes32 s = _SLOT_AVAILABLE_COLLATERALS;
        assembly {
            availableCollaterals.slot := s
        }
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/CollateralLock.sol:CollateralLock
library CollateralLock {
    struct Data {
        uint128 amountD18;
        uint64 lockExpirationTime;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/Config.sol:Config
library Config {
    struct Data {
        uint256 __unused;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/Distribution.sol:Distribution
library Distribution {
    struct Data {
        uint128 totalSharesD18;
        int128 valuePerShareD27;
        mapping(bytes32 => DistributionActor.Data) actorInfo;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/DistributionActor.sol:DistributionActor
library DistributionActor {
    struct Data {
        uint128 sharesD18;
        int128 lastValuePerShareD27;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/Market.sol:Market
library Market {
    struct Data {
        uint128 id;
        address marketAddress;
        int128 netIssuanceD18;
        int128 creditCapacityD18;
        int128 lastDistributedMarketBalanceD18;
        HeapUtil.Data inRangePools;
        HeapUtil.Data outRangePools;
        Distribution.Data poolsDebtDistribution;
        mapping(uint128 => MarketPoolInfo.Data) pools;
        DepositedCollateral[] depositedCollateral;
        mapping(address => uint256) maximumDepositableD18;
        uint32 minDelegateTime;
        uint32 __reservedForLater1;
        uint64 __reservedForLater2;
        uint64 __reservedForLater3;
        uint64 __reservedForLater4;
        uint256 minLiquidityRatioD18;
    }
    struct DepositedCollateral {
        address collateralType;
        uint256 amountD18;
    }
    function load(uint128 id) internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Market", id));
        assembly {
            market.slot := s
        }
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/MarketConfiguration.sol:MarketConfiguration
library MarketConfiguration {
    struct Data {
        uint128 marketId;
        uint128 weightD18;
        int128 maxDebtShareValueD18;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/MarketPoolInfo.sol:MarketPoolInfo
library MarketPoolInfo {
    struct Data {
        uint128 creditCapacityAmountD18;
        uint128 pendingDebtD18;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/OracleManager.sol:OracleManager
library OracleManager {
    bytes32 private constant _SLOT_ORACLE_MANAGER = keccak256(abi.encode("io.synthetix.synthetix.OracleManager"));
    struct Data {
        address oracleManagerAddress;
    }
    function load() internal pure returns (Data storage oracleManager) {
        bytes32 s = _SLOT_ORACLE_MANAGER;
        assembly {
            oracleManager.slot := s
        }
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/Pool.sol:Pool
library Pool {
    bytes32 private constant _CONFIG_SET_MARKET_MIN_DELEGATE_MAX = "setMarketMinDelegateTime_max";
    struct Data {
        uint128 id;
        string name;
        address owner;
        address nominatedOwner;
        uint128 totalWeightsD18;
        int128 totalVaultDebtsD18;
        MarketConfiguration.Data[] marketConfigurations;
        Distribution.Data vaultsDebtDistribution;
        mapping(address => Vault.Data) vaults;
        uint64 lastConfigurationTime;
        uint64 __reserved1;
        uint64 __reserved2;
        uint64 __reserved3;
    }
    function load(uint128 id) internal pure returns (Data storage pool) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Pool", id));
        assembly {
            pool.slot := s
        }
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/RewardDistribution.sol:RewardDistribution
library RewardDistribution {
    struct Data {
        address distributor;
        uint128 __slotAvailableForFutureUse;
        uint128 rewardPerShareD18;
        mapping(uint256 => RewardDistributionClaimStatus.Data) claimStatus;
        int128 scheduledValueD18;
        uint64 start;
        uint32 duration;
        uint32 lastUpdate;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/RewardDistributionClaimStatus.sol:RewardDistributionClaimStatus
library RewardDistributionClaimStatus {
    struct Data {
        uint128 lastRewardPerShareD18;
        uint128 pendingSendD18;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/ScalableMapping.sol:ScalableMapping
library ScalableMapping {
    struct Data {
        uint128 totalSharesD18;
        int128 scaleModifierD27;
        mapping(bytes32 => uint256) sharesD18;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/SystemPoolConfiguration.sol:SystemPoolConfiguration
library SystemPoolConfiguration {
    bytes32 private constant _SLOT_SYSTEM_POOL_CONFIGURATION = keccak256(abi.encode("io.synthetix.synthetix.SystemPoolConfiguration"));
    struct Data {
        uint256 minLiquidityRatioD18;
        uint128 __reservedForFutureUse;
        uint128 preferredPool;
        SetUtil.UintSet approvedPools;
    }
    function load() internal pure returns (Data storage systemPoolConfiguration) {
        bytes32 s = _SLOT_SYSTEM_POOL_CONFIGURATION;
        assembly {
            systemPoolConfiguration.slot := s
        }
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/Vault.sol:Vault
library Vault {
    struct Data {
        uint256 epoch;
        bytes32 __slotAvailableForFutureUse;
        int128 prevTotalDebtD18;
        mapping(uint256 => VaultEpoch.Data) epochData;
        mapping(bytes32 => RewardDistribution.Data) rewards;
        SetUtil.Bytes32Set rewardIds;
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/VaultEpoch.sol:VaultEpoch
library VaultEpoch {
    struct Data {
        int128 unconsolidatedDebtD18;
        int128 totalConsolidatedDebtD18;
        Distribution.Data accountsDebtDistribution;
        ScalableMapping.Data collateralAmounts;
        mapping(uint256 => int256) consolidatedDebtAmountsD18;
        mapping(uint128 => uint64) lastDelegationTime;
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

// @custom:artifact contracts/interfaces/IAsyncOrderModule.sol:IAsyncOrderModule
interface IAsyncOrderModule {
    struct SettleOrderRuntime {
        uint128 marketId;
        uint128 accountId;
        int128 newPositionSize;
        int256 pnl;
        uint256 pnlUint;
        uint256 amountToDeposit;
        uint256 settlementReward;
        bytes32 trackingCode;
    }
}

// @custom:artifact contracts/interfaces/IPerpsMarketModule.sol:IPerpsMarketModule
interface IPerpsMarketModule {
    struct MarketSummary {
        int256 skew;
        uint256 size;
        uint256 maxOpenInterest;
        int currentFundingRate;
        int currentFundingVelocity;
        uint indexPrice;
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

// @custom:artifact contracts/modules/PerpsMarketFactoryModule.sol:PerpsMarketFactoryModule
contract PerpsMarketFactoryModule {
    bytes32 private constant _CREATE_MARKET_FEATURE_FLAG = "createMarket";
    bytes32 private constant _ACCOUNT_TOKEN_SYSTEM = "accountNft";
}

// @custom:artifact contracts/storage/AsyncOrder.sol:AsyncOrder
library AsyncOrder {
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
        uint orderFees;
        uint availableMargin;
        uint currentLiquidationMargin;
        int128 newPositionSize;
        uint newNotionalValue;
        int currentAvailableMargin;
        uint requiredMaintenanceMargin;
        uint initialRequiredMargin;
        uint totalRequiredMargin;
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
        mapping(uint128 => uint256) collateralAmounts;
        uint128 id;
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet openPositionMarketIds;
    }
    struct RuntimeLiquidationData {
        uint totalLosingPnl;
        uint accumulatedLiquidationRewards;
        uint liquidationReward;
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
    struct Data {
        OrderFee.Data orderFees;
        SettlementStrategy.Data[] settlementStrategies;
        uint256 maxMarketValue;
        uint256 maxFundingVelocity;
        uint256 skewScale;
        uint256 initialMarginFraction;
        uint256 maintenanceMarginFraction;
        uint256 lockedOiPercent;
        uint256 maxLiquidationLimitAccumulationMultiplier;
        uint256 liquidationRewardRatioD18;
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
        PYTH
    }
    struct Data {
        Type strategyType;
        uint256 settlementDelay;
        uint256 settlementWindowDuration;
        uint256 priceWindowDuration;
        address priceVerificationContract;
        bytes32 feedId;
        string url;
        uint256 settlementReward;
        uint256 priceDeviationTolerance;
        bool disabled;
    }
}
