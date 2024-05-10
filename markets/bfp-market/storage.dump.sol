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

// @custom:artifact contracts/interfaces/IMarginModule.sol:IMarginModule
interface IMarginModule {
    struct ConfiguredCollateral {
        address collateralAddress;
        bytes32 oracleNodeId;
        uint128 maxAllowable;
        uint128 skewScale;
        address rewardDistributor;
    }
}

// @custom:artifact contracts/interfaces/IMarketConfigurationModule.sol:IMarketConfigurationModule
interface IMarketConfigurationModule {
    struct GlobalMarketConfigureParameters {
        uint64 pythPublishTimeMin;
        uint64 pythPublishTimeMax;
        uint128 minOrderAge;
        uint128 maxOrderAge;
        uint256 minKeeperFeeUsd;
        uint256 maxKeeperFeeUsd;
        uint128 keeperProfitMarginPercent;
        uint128 keeperProfitMarginUsd;
        uint128 keeperSettlementGasUnits;
        uint128 keeperCancellationGasUnits;
        uint128 keeperLiquidationGasUnits;
        uint256 keeperLiquidationFeeUsd;
        uint128 keeperFlagGasUnits;
        uint128 keeperLiquidateMarginGasUnits;
        address keeperLiquidationEndorsed;
        uint128 collateralDiscountScalar;
        uint128 minCollateralDiscount;
        uint128 maxCollateralDiscount;
        uint128 sellExactInMaxSlippagePercent;
        uint128 utilizationBreakpointPercent;
        uint128 lowUtilizationSlopePercent;
        uint128 highUtilizationSlopePercent;
    }
    struct ConfigureByMarketParameters {
        bytes32 oracleNodeId;
        bytes32 pythPriceFeedId;
        uint128 makerFee;
        uint128 takerFee;
        uint128 maxMarketSize;
        uint128 maxFundingVelocity;
        uint128 skewScale;
        uint128 fundingVelocityClamp;
        uint128 minCreditPercent;
        uint256 minMarginUsd;
        uint256 minMarginRatio;
        uint256 incrementalMarginScalar;
        uint256 maintenanceMarginScalar;
        uint256 maxInitialMarginRatio;
        uint256 liquidationRewardPercent;
        uint128 liquidationLimitScalar;
        uint128 liquidationWindowDuration;
        uint128 liquidationMaxPd;
    }
}

// @custom:artifact contracts/interfaces/IOrderModule.sol:IOrderModule
interface IOrderModule {
    struct OrderDigest {
        int128 sizeDelta;
        uint256 commitmentTime;
        uint256 limitPrice;
        uint256 keeperFeeBufferUsd;
        address[] hooks;
        bool isStale;
        bool isReady;
    }
}

// @custom:artifact contracts/interfaces/IPerpAccountModule.sol:IPerpAccountModule
interface IPerpAccountModule {
    struct DepositedCollateral {
        address collateralAddress;
        uint256 available;
        uint256 oraclePrice;
    }
    struct AccountDigest {
        IPerpAccountModule.DepositedCollateral[] depositedCollaterals;
        uint256 collateralUsd;
        uint128 debtUsd;
        PositionDigest position;
    }
    struct PositionDigest {
        uint128 accountId;
        uint128 marketId;
        uint256 remainingMarginUsd;
        uint256 healthFactor;
        uint256 notionalValueUsd;
        int256 pnl;
        int256 accruedFunding;
        uint256 accruedUtilization;
        uint256 entryPythPrice;
        uint256 entryPrice;
        uint256 oraclePrice;
        int128 size;
        uint256 im;
        uint256 mm;
    }
}

// @custom:artifact contracts/interfaces/IPerpMarketFactoryModule.sol:IPerpMarketFactoryModule
interface IPerpMarketFactoryModule {
    struct CreatePerpMarketParameters {
        bytes32 name;
    }
    struct DepositedCollateral {
        address collateralAddress;
        uint256 available;
    }
    struct UtilizationDigest {
        uint256 lastComputedUtilizationRate;
        uint256 lastComputedTimestamp;
        uint256 currentUtilizationRate;
        uint256 utilization;
    }
    struct MarketDigest {
        IPerpMarketFactoryModule.DepositedCollateral[] depositedCollaterals;
        bytes32 name;
        int128 skew;
        uint128 size;
        uint256 oraclePrice;
        int256 fundingVelocity;
        int256 fundingRate;
        uint256 utilizationRate;
        uint256 remainingLiquidatableSizeCapacity;
        uint128 lastLiquidationTime;
        uint128 totalTraderDebtUsd;
        uint256 totalCollateralValueUsd;
        int128 debtCorrection;
    }
}

// @custom:artifact contracts/interfaces/IPerpRewardDistributorFactoryModule.sol:IPerpRewardDistributorFactoryModule
interface IPerpRewardDistributorFactoryModule {
    struct CreatePerpRewardDistributorParameters {
        uint128 poolId;
        address[] collateralTypes;
        string name;
        address token;
    }
}

// @custom:artifact contracts/interfaces/ISettlementHookModule.sol:ISettlementHookModule
interface ISettlementHookModule {
    struct SettlementHookConfigureParameters {
        address[] whitelistedHookAddresses;
        uint32 maxHooksPerOrder;
    }
}

// @custom:artifact contracts/modules/LiquidationModule.sol:LiquidationModule
contract LiquidationModule {
    struct Runtime_liquidateCollateral {
        uint256 availableSusd;
        uint256 supportedCollateralssLength;
        address collateralAddress;
        uint256 availableAccountCollateral;
        uint128 poolId;
        uint256 poolCollateralTypesLength;
    }
}

// @custom:artifact contracts/modules/MarginModule.sol:MarginModule
contract MarginModule {
    uint256 private constant MAX_SUPPORTED_MARGIN_COLLATERALS = 10;
    struct Runtime_setMarginCollateralConfiguration {
        uint256 lengthBefore;
        uint256 lengthAfter;
        uint256 maxApproveAmount;
        address[] previousSupportedCollaterals;
        uint256 i;
    }
}

// @custom:artifact contracts/modules/OrderModule.sol:OrderModule
contract OrderModule {
    struct Runtime_settleOrder {
        uint256 pythPrice;
        int256 accruedFunding;
        uint256 accruedUtilization;
        int256 pricePnl;
        uint256 fillPrice;
        uint128 updatedMarketSize;
        int128 updatedMarketSkew;
        uint128 totalFees;
        Position.ValidatedTrade trade;
        Position.TradeParams params;
    }
}

// @custom:artifact contracts/modules/PerpAccountModule.sol:PerpAccountModule
contract PerpAccountModule {
    struct Runtime_splitAccount {
        uint256 oraclePrice;
        uint256 toIm;
        uint256 fromIm;
        uint128 debtToMove;
        int128 sizeToMove;
        uint256 supportedCollateralsLength;
        address collateralAddress;
        uint256 collateralToMove;
        uint256 newFromAmountCollateral;
        uint256 fromAccountCollateral;
        uint256 toCollateralUsd;
        uint256 fromCollateralUsd;
        uint256 toDiscountedCollateralUsd;
        uint256 fromDiscountedCollateralUsd;
        uint256 collateralPrice;
    }
    struct Runtime_mergeAccounts {
        uint256 oraclePrice;
        uint256 im;
        uint256 fromCollateralUsd;
        uint256 fromMarginUsd;
        uint256 toMarginUsd;
        uint256 mergedCollateralUsd;
        uint256 mergedDiscountedCollateralUsd;
        uint256 supportedCollateralsLength;
        address collateralAddress;
        uint256 fromAccountCollateral;
    }
}

// @custom:artifact contracts/storage/Margin.sol:Margin
library Margin {
    struct CollateralType {
        bytes32 oracleNodeId;
        uint128 maxAllowable;
        uint128 skewScale;
        address rewardDistributor;
        bool exists;
    }
    struct MarginValues {
        uint256 discountedMarginUsd;
        uint256 marginUsd;
        uint256 discountedCollateralUsd;
        uint256 collateralUsd;
    }
    struct GlobalData {
        mapping(address => CollateralType) supported;
        address[] supportedCollaterals;
    }
    struct Data {
        mapping(address => uint256) collaterals;
        uint128 debtUsd;
    }
    function load() internal pure returns (Margin.GlobalData storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.GlobalMargin"));
        assembly {
            d.slot := s
        }
    }
    function load(uint128 accountId, uint128 marketId) internal pure returns (Margin.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Margin", accountId, marketId));
        assembly {
            d.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Order.sol:Order
library Order {
    struct Data {
        int128 sizeDelta;
        uint256 commitmentTime;
        uint256 limitPrice;
        uint256 keeperFeeBufferUsd;
        address[] hooks;
    }
}

// @custom:artifact contracts/storage/PerpMarket.sol:PerpMarket
library PerpMarket {
    struct GlobalData {
        uint128[] activeMarketIds;
    }
    struct Data {
        uint128 id;
        bytes32 name;
        int128 skew;
        uint128 size;
        uint128 totalTraderDebtUsd;
        int256 currentFundingRateComputed;
        int256 currentFundingAccruedComputed;
        uint256 lastFundingTime;
        uint256 currentUtilizationRateComputed;
        uint256 currentUtilizationAccruedComputed;
        uint256 lastUtilizationTime;
        int128 debtCorrection;
        mapping(uint128 => Order.Data) orders;
        mapping(uint128 => Position.Data) positions;
        mapping(uint128 => address) flaggedLiquidations;
        mapping(address => uint256) depositedCollateral;
        uint128[][] pastLiquidations;
    }
    function load() internal pure returns (GlobalData storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.GlobalPerpMarket"));
        assembly {
            d.slot := s
        }
    }
    function load(uint128 id) internal pure returns (Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarket", id));
        assembly {
            d.slot := s
        }
    }
}

// @custom:artifact contracts/storage/PerpMarketConfiguration.sol:PerpMarketConfiguration
library PerpMarketConfiguration {
    struct GlobalData {
        address synthetix;
        address usdToken;
        address oracleManager;
        address pyth;
        bytes32 ethOracleNodeId;
        address rewardDistributorImplementation;
        uint64 pythPublishTimeMin;
        uint64 pythPublishTimeMax;
        uint128 minOrderAge;
        uint128 maxOrderAge;
        uint256 minKeeperFeeUsd;
        uint256 maxKeeperFeeUsd;
        uint128 keeperProfitMarginUsd;
        uint128 keeperProfitMarginPercent;
        uint128 keeperSettlementGasUnits;
        uint128 keeperCancellationGasUnits;
        uint128 keeperLiquidationGasUnits;
        uint128 keeperFlagGasUnits;
        uint128 keeperLiquidateMarginGasUnits;
        uint256 keeperLiquidationFeeUsd;
        address keeperLiquidationEndorsed;
        uint128 collateralDiscountScalar;
        uint128 minCollateralDiscount;
        uint128 maxCollateralDiscount;
        uint128 sellExactInMaxSlippagePercent;
        uint128 utilizationBreakpointPercent;
        uint128 lowUtilizationSlopePercent;
        uint128 highUtilizationSlopePercent;
    }
    struct Data {
        bytes32 oracleNodeId;
        bytes32 pythPriceFeedId;
        uint128 makerFee;
        uint128 takerFee;
        uint128 maxMarketSize;
        uint128 maxFundingVelocity;
        uint128 skewScale;
        uint128 fundingVelocityClamp;
        uint128 minCreditPercent;
        uint256 minMarginUsd;
        uint256 minMarginRatio;
        uint256 incrementalMarginScalar;
        uint256 maintenanceMarginScalar;
        uint256 maxInitialMarginRatio;
        uint256 liquidationRewardPercent;
        uint128 liquidationLimitScalar;
        uint128 liquidationWindowDuration;
        uint128 liquidationMaxPd;
    }
    function load() internal pure returns (PerpMarketConfiguration.GlobalData storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.GlobalPerpMarketConfiguration"));
        assembly {
            d.slot := s
        }
    }
    function load(uint128 marketId) internal pure returns (PerpMarketConfiguration.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarketConfiguration", marketId));
        assembly {
            d.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Position.sol:Position
library Position {
    struct TradeParams {
        int128 sizeDelta;
        uint256 oraclePrice;
        uint256 pythPrice;
        uint256 fillPrice;
        uint128 makerFee;
        uint128 takerFee;
        uint256 limitPrice;
        uint256 keeperFeeBufferUsd;
    }
    struct ValidatedTrade {
        Position.Data newPosition;
        uint256 orderFee;
        uint256 keeperFee;
        uint256 newMarginUsd;
        uint256 collateralUsd;
    }
    struct HealthData {
        uint256 healthFactor;
        int256 accruedFunding;
        uint256 accruedUtilization;
        int256 pnl;
    }
    struct Runtime_validateLiquidation {
        address flagger;
        uint128 oldPositionSizeAbs;
        uint128 maxLiquidatableCapacity;
        uint128 remainingCapacity;
        uint128 lastLiquidationTime;
    }
    struct Data {
        int128 size;
        int256 entryFundingAccrued;
        uint256 entryUtilizationAccrued;
        uint256 entryPythPrice;
        uint256 entryPrice;
    }
}

// @custom:artifact contracts/storage/SettlementHookConfiguration.sol:SettlementHookConfiguration
library SettlementHookConfiguration {
    bytes32 private constant SLOT_NAME = keccak256(abi.encode("io.synthetix.bfp-market.SettlementHookConfiguration"));
    struct GlobalData {
        mapping(address => bool) whitelisted;
        address[] whitelistedHookAddresses;
        uint32 maxHooksPerOrder;
    }
    function load() internal pure returns (SettlementHookConfiguration.GlobalData storage d) {
        bytes32 s = SLOT_NAME;
        assembly {
            d.slot := s
        }
    }
}

// @custom:artifact contracts/utils/Flags.sol:Flags
library Flags {
    bytes32 public constant CREATE_ACCOUNT = "createAccount";
    bytes32 public constant DEPOSIT = "deposit";
    bytes32 public constant WITHDRAW = "withdraw";
    bytes32 public constant COMMIT_ORDER = "commitOrder";
    bytes32 public constant SETTLE_ORDER = "settleOrder";
    bytes32 public constant CANCEL_ORDER = "cancelOrder";
    bytes32 public constant FLAG_POSITION = "flagPosition";
    bytes32 public constant LIQUIDATE_POSITION = "liquidatePosition";
    bytes32 public constant PAY_DEBT = "payDebt";
    bytes32 public constant LIQUIDATE_MARGIN_ONLY = "liquidateMarginOnly";
    bytes32 public constant MERGE_ACCOUNT = "mergeAccount";
    bytes32 public constant SPLIT_ACCOUNT = "splitAccount";
}
