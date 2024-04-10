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

// @custom:artifact @synthetixio/core-contracts/contracts/utils/ERC2771Context.sol:ERC2771Context
library ERC2771Context {
    address private constant TRUSTED_FORWARDER = 0xE2C5658cC5C448B48141168f3e475dF8f65A1e3e;
}

// @custom:artifact @synthetixio/core-contracts/contracts/utils/HeapUtil.sol:HeapUtil
library HeapUtil {
    uint256 private constant _ROOT_INDEX = 1;
    struct Data {
        uint128 idCount;
        Node[] nodes;
        mapping(uint128 => uint256) indices;
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
        mapping(bytes32 => uint256) _positions;
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
    bytes32 internal constant _PERPS_COMMIT_ASYNC_ORDER_PERMISSION = "PERPS_COMMIT_ASYNC_ORDER";
    bytes32 internal constant _BURN_PERMISSION = "BURN";
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
        mapping(address => PoolCollateralConfiguration.Data) collateralConfigurations;
        bool collateralDisabledByDefault;
    }
    function load(uint128 id) internal pure returns (Data storage pool) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Pool", id));
        assembly {
            pool.slot := s
        }
    }
}

// @custom:artifact @synthetixio/main/contracts/storage/PoolCollateralConfiguration.sol:PoolCollateralConfiguration
library PoolCollateralConfiguration {
    bytes32 private constant _SLOT = keccak256(abi.encode("io.synthetix.synthetix.PoolCollateralConfiguration"));
    struct Data {
        uint256 collateralLimitD18;
        uint256 issuanceRatioD18;
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
        int128 _unused_prevTotalDebtD18;
        mapping(uint256 => VaultEpoch.Data) epochData;
        mapping(bytes32 => RewardDistribution.Data) rewards;
        SetUtil.Bytes32Set rewardIds;
    }
    struct PositionSelector {
        uint128 accountId;
        uint128 poolId;
        address collateralType;
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

// @custom:artifact @synthetixio/rewards-distributor/src/RewardsDistributor.sol:RewardsDistributor
contract RewardsDistributor {
    uint256 public constant SYSTEM_PRECISION = 10 ** 18;
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

// @custom:artifact contracts/interfaces/IAsyncOrderCancelModule.sol:IAsyncOrderCancelModule
interface IAsyncOrderCancelModule {
    struct CancelOrderRuntime {
        uint128 marketId;
        uint128 accountId;
        int128 sizeDelta;
        uint256 settlementReward;
        uint256 fillPrice;
        uint256 acceptablePrice;
    }
}

// @custom:artifact contracts/interfaces/IAsyncOrderSettlementPythModule.sol:IAsyncOrderSettlementPythModule
interface IAsyncOrderSettlementPythModule {
    struct SettleOrderRuntime {
        uint128 marketId;
        uint128 accountId;
        int128 sizeDelta;
        int256 pnl;
        uint256 chargedInterest;
        int256 accruedFunding;
        uint256 pnlUint;
        uint256 amountToDeduct;
        uint256 settlementReward;
        uint256 fillPrice;
        uint256 totalFees;
        uint256 referralFees;
        uint256 feeCollectorFees;
        Position.Data newPosition;
        MarketUpdate.Data updateData;
        uint256 synthDeductionIterator;
        uint128[] deductedSynthIds;
        uint256[] deductedAmount;
    }
}

// @custom:artifact contracts/interfaces/IPerpsMarketModule.sol:IPerpsMarketModule
interface IPerpsMarketModule {
    struct MarketSummary {
        int256 skew;
        uint256 size;
        uint256 maxOpenInterest;
        int256 currentFundingRate;
        int256 currentFundingVelocity;
        uint256 indexPrice;
    }
}

// @custom:artifact contracts/modules/LiquidationModule.sol:LiquidationModule
contract LiquidationModule {
    struct LiquidateAccountRuntime {
        uint128 accountId;
        uint256 totalFlaggingRewards;
        uint256 totalLiquidated;
        bool accountFullyLiquidated;
        uint256 totalLiquidationCost;
        uint256 price;
        uint128 positionMarketId;
        uint256 loopIterator;
    }
}

// @custom:artifact contracts/modules/PerpsMarketFactoryModule.sol:PerpsMarketFactoryModule
contract PerpsMarketFactoryModule {
    bytes32 private constant _ACCOUNT_TOKEN_SYSTEM = "accountNft";
}

// @custom:artifact contracts/storage/AsyncOrder.sol:AsyncOrder
library AsyncOrder {
    struct Data {
        uint256 commitmentTime;
        OrderCommitmentRequest request;
    }
    struct OrderCommitmentRequest {
        uint128 marketId;
        uint128 accountId;
        int128 sizeDelta;
        uint128 settlementStrategyId;
        uint256 acceptablePrice;
        bytes32 trackingCode;
        address referrer;
    }
    struct SimulateDataRuntime {
        bool isEligible;
        int128 sizeDelta;
        uint128 accountId;
        uint128 marketId;
        uint256 fillPrice;
        uint256 orderFees;
        uint256 availableMargin;
        uint256 currentLiquidationMargin;
        uint256 accumulatedLiquidationRewards;
        uint256 currentLiquidationReward;
        int128 newPositionSize;
        uint256 newNotionalValue;
        int256 currentAvailableMargin;
        uint256 requiredInitialMargin;
        uint256 initialRequiredMargin;
        uint256 totalRequiredMargin;
        Position.Data newPosition;
        bytes32 trackingCode;
    }
    struct RequiredMarginWithNewPositionRuntime {
        uint256 newRequiredMargin;
        uint256 oldRequiredMargin;
        uint256 requiredMarginForNewPosition;
        uint256 accumulatedLiquidationRewards;
        uint256 maxNumberOfWindows;
        uint256 numberOfWindows;
        uint256 requiredRewardMargin;
    }
    function load(uint128 accountId) internal pure returns (Data storage order) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.AsyncOrder", accountId));
        assembly {
            order.slot := s
        }
    }
}

// @custom:artifact contracts/storage/GlobalPerpsMarket.sol:GlobalPerpsMarket
library GlobalPerpsMarket {
    bytes32 private constant _SLOT_GLOBAL_PERPS_MARKET = keccak256(abi.encode("io.synthetix.perps-market.GlobalPerpsMarket"));
    struct Data {
        SetUtil.UintSet liquidatableAccounts;
        mapping(uint128 => uint256) collateralAmounts;
        SetUtil.UintSet activeCollateralTypes;
        SetUtil.UintSet activeMarkets;
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
        address feeCollector;
        mapping(address => uint256) referrerShare;
        mapping(uint128 => uint256) __unused_1;
        uint128[] synthDeductionPriority;
        uint256 minKeeperRewardUsd;
        uint256 maxKeeperRewardUsd;
        uint128 maxPositionsPerAccount;
        uint128 maxCollateralsPerAccount;
        uint256 minKeeperProfitRatioD18;
        uint256 maxKeeperScalingRatioD18;
        SetUtil.UintSet supportedCollateralTypes;
        uint128 lowUtilizationInterestRateGradient;
        uint128 interestRateGradientBreakpoint;
        uint128 highUtilizationInterestRateGradient;
        uint128 collateralLiquidateRewardRatioD18;
        address rewardDistributorImplementation;
    }
    function load() internal pure returns (Data storage globalMarketConfig) {
        bytes32 s = _SLOT_GLOBAL_PERPS_MARKET_CONFIGURATION;
        assembly {
            globalMarketConfig.slot := s
        }
    }
}

// @custom:artifact contracts/storage/InterestRate.sol:InterestRate
library InterestRate {
    uint256 private constant AVERAGE_SECONDS_PER_YEAR = 31557600;
    bytes32 private constant _SLOT_INTEREST_RATE = keccak256(abi.encode("io.synthetix.perps-market.InterestRate"));
    struct Data {
        uint256 interestAccrued;
        uint128 interestRate;
        uint256 lastTimestamp;
    }
    function load() internal pure returns (Data storage interestRate) {
        bytes32 s = _SLOT_INTEREST_RATE;
        assembly {
            interestRate.slot := s
        }
    }
}

// @custom:artifact contracts/storage/KeeperCosts.sol:KeeperCosts
library KeeperCosts {
    uint256 private constant KIND_SETTLEMENT = 0;
    uint256 private constant KIND_FLAG = 1;
    uint256 private constant KIND_LIQUIDATE = 2;
    struct Data {
        bytes32 keeperCostNodeId;
    }
    function load() internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.KeeperCosts"));
        assembly {
            price.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Liquidation.sol:Liquidation
library Liquidation {
    struct Data {
        uint128 amount;
        uint256 timestamp;
    }
}

// @custom:artifact contracts/storage/LiquidationAssetManager.sol:LiquidationAssetManager
library LiquidationAssetManager {
    struct Data {
        uint128 id;
        address distributor;
        address[] poolDelegatedCollateralTypes;
    }
}

// @custom:artifact contracts/storage/MarketUpdate.sol:MarketUpdate
library MarketUpdate {
    struct Data {
        uint128 marketId;
        uint128 interestRate;
        int256 skew;
        uint256 size;
        int256 currentFundingRate;
        int256 currentFundingVelocity;
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
        uint256 debt;
    }
    function load(uint128 id) internal pure returns (Data storage account) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Account", id));
        assembly {
            account.slot := s
        }
    }
}

// @custom:artifact contracts/storage/PerpsCollateralConfiguration.sol:PerpsCollateralConfiguration
library PerpsCollateralConfiguration {
    struct Data {
        uint128 id;
        uint256 maxAmount;
        uint256 upperLimitDiscount;
        uint256 lowerLimitDiscount;
        uint256 discountScalar;
        LiquidationAssetManager.Data lam;
    }
    function load(uint128 collateralId) internal pure returns (Data storage collateralConfig) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.CollateralConfiguration", collateralId));
        assembly {
            collateralConfig.slot := s
        }
    }
}

// @custom:artifact contracts/storage/PerpsMarket.sol:PerpsMarket
library PerpsMarket {
    struct Data {
        string name;
        string symbol;
        uint128 id;
        int256 skew;
        uint256 size;
        int256 lastFundingRate;
        int256 lastFundingValue;
        uint256 lastFundingTime;
        uint128 __unused_1;
        uint128 __unused_2;
        int256 debtCorrectionAccumulator;
        mapping(uint256 => AsyncOrder.Data) asyncOrders;
        mapping(uint256 => Position.Data) positions;
        Liquidation.Data[] liquidationData;
    }
    struct PositionDataRuntime {
        uint256 currentPrice;
        int256 sizeDelta;
        int256 fundingDelta;
        int256 notionalDelta;
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
        uint256 maxMarketSize;
        uint256 maxFundingVelocity;
        uint256 skewScale;
        uint256 initialMarginRatioD18;
        uint256 maintenanceMarginScalarD18;
        uint256 lockedOiRatioD18;
        uint256 maxLiquidationLimitAccumulationMultiplier;
        uint256 maxSecondsInLiquidationWindow;
        uint256 flagRewardRatioD18;
        uint256 minimumPositionMargin;
        uint256 minimumInitialMarginRatioD18;
        uint256 maxLiquidationPd;
        address endorsedLiquidator;
        uint256 maxMarketValue;
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
        uint128 perpsMarketId;
        string name;
        address liquidationAssetManager;
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
    enum Tolerance {
        DEFAULT,
        STRICT
    }
    struct Data {
        bytes32 feedId;
        uint256 strictStalenessTolerance;
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
        uint256 latestInterestAccrued;
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
        address priceVerificationContract;
        bytes32 feedId;
        uint256 settlementReward;
        bool disabled;
        uint256 commitmentPriceDelay;
    }
}

// @custom:artifact contracts/utils/BigNumber.sol:BigNumber
library BigNumber {
    uint256 internal constant CHUNK_SIZE = 2 ** 255;
    struct Data {
        uint256[] chunks;
    }
    struct Snapshot {
        uint256 currentChunkId;
        uint256 valueAtChunk;
    }
}

// @custom:artifact contracts/utils/Flags.sol:Flags
library Flags {
    bytes32 public constant PERPS_SYSTEM = "perpsSystem";
    bytes32 public constant CREATE_MARKET = "createMarket";
}
