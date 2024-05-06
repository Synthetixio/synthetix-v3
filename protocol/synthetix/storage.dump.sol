// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

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

// @custom:artifact contracts/interfaces/IAccountModule.sol:IAccountModule
interface IAccountModule {
    struct AccountPermissions {
        address user;
        bytes32[] permissions;
    }
}

// @custom:artifact contracts/interfaces/ILiquidationModule.sol:ILiquidationModule
interface ILiquidationModule {
    struct LiquidationData {
        uint256 debtLiquidated;
        uint256 collateralLiquidated;
        uint256 amountRewarded;
    }
}

// @custom:artifact contracts/modules/core/AccountModule.sol:AccountModule
contract AccountModule {
    bytes32 private constant _ACCOUNT_SYSTEM = "accountNft";
    bytes32 private constant _CREATE_ACCOUNT_FEATURE_FLAG = "createAccount";
}

// @custom:artifact contracts/modules/core/AssociateDebtModule.sol:AssociateDebtModule
contract AssociateDebtModule {
    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _ASSOCIATE_DEBT_FEATURE_FLAG = "associateDebt";
}

// @custom:artifact contracts/modules/core/CollateralModule.sol:CollateralModule
contract CollateralModule {
    bytes32 private constant _DEPOSIT_FEATURE_FLAG = "deposit";
    bytes32 private constant _WITHDRAW_FEATURE_FLAG = "withdraw";
    bytes32 private constant _CONFIG_TIMEOUT_WITHDRAW = "accountTimeoutWithdraw";
}

// @custom:artifact contracts/modules/core/CrossChainUSDModule.sol:CrossChainUSDModule
contract CrossChainUSDModule {
    uint256 private constant _TRANSFER_GAS_LIMIT = 100000;
    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _TRANSFER_CROSS_CHAIN_FEATURE_FLAG = "transferCrossChain";
}

// @custom:artifact contracts/modules/core/IssueUSDModule.sol:IssueUSDModule
contract IssueUSDModule {
    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _MINT_FEATURE_FLAG = "mintUsd";
    bytes32 private constant _BURN_FEATURE_FLAG = "burnUsd";
    bytes32 private constant _CONFIG_MINT_FEE_RATIO = "mintUsd_feeRatio";
    bytes32 private constant _CONFIG_BURN_FEE_RATIO = "burnUsd_feeRatio";
    bytes32 private constant _CONFIG_MINT_FEE_ADDRESS = "mintUsd_feeAddress";
    bytes32 private constant _CONFIG_BURN_FEE_ADDRESS = "burnUsd_feeAddress";
}

// @custom:artifact contracts/modules/core/LiquidationModule.sol:LiquidationModule
contract LiquidationModule {
    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _LIQUIDATE_FEATURE_FLAG = "liquidate";
    bytes32 private constant _LIQUIDATE_VAULT_FEATURE_FLAG = "liquidateVault";
}

// @custom:artifact contracts/modules/core/MarketCollateralModule.sol:MarketCollateralModule
contract MarketCollateralModule {
    bytes32 private constant _DEPOSIT_MARKET_COLLATERAL_FEATURE_FLAG = "depositMarketCollateral";
    bytes32 private constant _WITHDRAW_MARKET_COLLATERAL_FEATURE_FLAG = "withdrawMarketCollateral";
}

// @custom:artifact contracts/modules/core/MarketManagerModule.sol:MarketManagerModule
contract MarketManagerModule {
    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _MARKET_FEATURE_FLAG = "registerMarket";
    bytes32 private constant _DEPOSIT_MARKET_FEATURE_FLAG = "depositMarketUsd";
    bytes32 private constant _WITHDRAW_MARKET_FEATURE_FLAG = "withdrawMarketUsd";
    bytes32 private constant _CONFIG_SET_MARKET_MIN_DELEGATE_MAX = "setMarketMinDelegateTime_max";
    bytes32 private constant _CONFIG_DEPOSIT_MARKET_USD_FEE_RATIO = "depositMarketUsd_feeRatio";
    bytes32 private constant _CONFIG_WITHDRAW_MARKET_USD_FEE_RATIO = "withdrawMarketUsd_feeRatio";
    bytes32 private constant _CONFIG_DEPOSIT_MARKET_USD_FEE_ADDRESS = "depositMarketUsd_feeAddress";
    bytes32 private constant _CONFIG_WITHDRAW_MARKET_USD_FEE_ADDRESS = "withdrawMarketUsd_feeAddress";
}

// @custom:artifact contracts/modules/core/PoolModule.sol:PoolModule
contract PoolModule {
    bytes32 private constant _POOL_FEATURE_FLAG = "createPool";
}

// @custom:artifact contracts/modules/core/RewardsManagerModule.sol:RewardsManagerModule
contract RewardsManagerModule {
    uint256 private constant _MAX_REWARD_DISTRIBUTIONS = 10;
    bytes32 private constant _CLAIM_FEATURE_FLAG = "claimRewards";
}

// @custom:artifact contracts/modules/core/UtilsModule.sol:UtilsModule
contract UtilsModule {
    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _CCIP_CHAINLINK_SEND = "ccipChainlinkSend";
    bytes32 private constant _CCIP_CHAINLINK_RECV = "ccipChainlinkRecv";
    bytes32 private constant _CCIP_CHAINLINK_TOKEN_POOL = "ccipChainlinkTokenPool";
}

// @custom:artifact contracts/modules/core/VaultModule.sol:VaultModule
contract VaultModule {
    bytes32 private constant _DELEGATE_FEATURE_FLAG = "delegateCollateral";
}

// @custom:artifact contracts/modules/usd/USDTokenModule.sol:USDTokenModule
contract USDTokenModule {
    bytes32 private constant _CCIP_CHAINLINK_TOKEN_POOL = "ccipChainlinkTokenPool";
}

// @custom:artifact contracts/storage/Account.sol:Account
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

// @custom:artifact contracts/storage/AccountRBAC.sol:AccountRBAC
library AccountRBAC {
    bytes32 internal constant _ADMIN_PERMISSION = "ADMIN";
    bytes32 internal constant _WITHDRAW_PERMISSION = "WITHDRAW";
    bytes32 internal constant _DELEGATE_PERMISSION = "DELEGATE";
    bytes32 internal constant _MINT_PERMISSION = "MINT";
    bytes32 internal constant _REWARDS_PERMISSION = "REWARDS";
    bytes32 internal constant _PERPS_MODIFY_COLLATERAL_PERMISSION = "PERPS_MODIFY_COLLATERAL";
    bytes32 internal constant _PERPS_COMMIT_ASYNC_ORDER_PERMISSION = "PERPS_COMMIT_ASYNC_ORDER";
    bytes32 internal constant _BURN_PERMISSION = "BURN";
    bytes32 internal constant _PERPS_PAY_DEBT_PERMISSION = "PERPS_PAY_DEBT";
    bytes32 internal constant _PERPS_SPLIT_ACCOUNT_PERMISSION = "PERPS_SPLIT_ACCOUNT";
    struct Data {
        address owner;
        mapping(address => SetUtil.Bytes32Set) permissions;
        SetUtil.AddressSet permissionAddresses;
    }
}

// @custom:artifact contracts/storage/Collateral.sol:Collateral
library Collateral {
    struct Data {
        uint256 amountAvailableForDelegationD18;
        SetUtil.UintSet pools;
        CollateralLock.Data[] locks;
    }
}

// @custom:artifact contracts/storage/CollateralConfiguration.sol:CollateralConfiguration
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

// @custom:artifact contracts/storage/CollateralLock.sol:CollateralLock
library CollateralLock {
    struct Data {
        uint128 amountD18;
        uint64 lockExpirationTime;
    }
}

// @custom:artifact contracts/storage/Config.sol:Config
library Config {
    struct Data {
        uint256 __unused;
    }
}

// @custom:artifact contracts/storage/CrossChain.sol:CrossChain
library CrossChain {
    bytes32 private constant _SLOT_CROSS_CHAIN = keccak256(abi.encode("io.synthetix.synthetix.CrossChain"));
    struct Data {
        address ccipRouter;
        SetUtil.UintSet supportedNetworks;
        mapping(uint64 => uint64) ccipChainIdToSelector;
        mapping(uint64 => uint64) ccipSelectorToChainId;
    }
    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Distribution.sol:Distribution
library Distribution {
    struct Data {
        uint128 totalSharesD18;
        int128 valuePerShareD27;
        mapping(bytes32 => DistributionActor.Data) actorInfo;
    }
}

// @custom:artifact contracts/storage/DistributionActor.sol:DistributionActor
library DistributionActor {
    struct Data {
        uint128 sharesD18;
        int128 lastValuePerShareD27;
    }
}

// @custom:artifact contracts/storage/Market.sol:Market
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

// @custom:artifact contracts/storage/MarketConfiguration.sol:MarketConfiguration
library MarketConfiguration {
    struct Data {
        uint128 marketId;
        uint128 weightD18;
        int128 maxDebtShareValueD18;
    }
}

// @custom:artifact contracts/storage/MarketCreator.sol:MarketCreator
library MarketCreator {
    bytes32 private constant _SLOT_MARKET_CREATOR = keccak256(abi.encode("io.synthetix.synthetix.Markets"));
    struct Data {
        mapping(address => uint128[]) marketIdsForAddress;
        uint128 lastCreatedMarketId;
    }
    function getMarketStore() internal pure returns (Data storage marketStore) {
        bytes32 s = _SLOT_MARKET_CREATOR;
        assembly {
            marketStore.slot := s
        }
    }
}

// @custom:artifact contracts/storage/MarketPoolInfo.sol:MarketPoolInfo
library MarketPoolInfo {
    struct Data {
        uint128 creditCapacityAmountD18;
        uint128 pendingDebtD18;
    }
}

// @custom:artifact contracts/storage/OracleManager.sol:OracleManager
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

// @custom:artifact contracts/storage/Pool.sol:Pool
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

// @custom:artifact contracts/storage/PoolCollateralConfiguration.sol:PoolCollateralConfiguration
library PoolCollateralConfiguration {
    bytes32 private constant _SLOT = keccak256(abi.encode("io.synthetix.synthetix.PoolCollateralConfiguration"));
    struct Data {
        uint256 collateralLimitD18;
        uint256 issuanceRatioD18;
    }
}

// @custom:artifact contracts/storage/RewardDistribution.sol:RewardDistribution
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

// @custom:artifact contracts/storage/RewardDistributionClaimStatus.sol:RewardDistributionClaimStatus
library RewardDistributionClaimStatus {
    struct Data {
        uint128 lastRewardPerShareD18;
        uint128 pendingSendD18;
    }
}

// @custom:artifact contracts/storage/ScalableMapping.sol:ScalableMapping
library ScalableMapping {
    struct Data {
        uint128 totalSharesD18;
        int128 scaleModifierD27;
        mapping(bytes32 => uint256) sharesD18;
    }
}

// @custom:artifact contracts/storage/SystemAccountConfiguration.sol:SystemAccountConfiguration
library SystemAccountConfiguration {
    bytes32 private constant _SLOT_SYSTEM_ACCOUNT_CONFIGURATION = keccak256(abi.encode("io.synthetix.synthetix.SystemAccountConfiguration"));
    struct Data {
        uint64 accountIdOffset;
    }
    function load() internal pure returns (Data storage systemAccountConfiguration) {
        bytes32 s = _SLOT_SYSTEM_ACCOUNT_CONFIGURATION;
        assembly {
            systemAccountConfiguration.slot := s
        }
    }
}

// @custom:artifact contracts/storage/SystemPoolConfiguration.sol:SystemPoolConfiguration
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

// @custom:artifact contracts/storage/Vault.sol:Vault
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

// @custom:artifact contracts/storage/VaultEpoch.sol:VaultEpoch
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

// @custom:artifact contracts/utils/CcipClient.sol:CcipClient
library CcipClient {
    bytes4 public constant EVM_EXTRA_ARGS_V1_TAG = 0x97a657c9;
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }
    struct Any2EVMMessage {
        bytes32 messageId;
        uint64 sourceChainSelector;
        bytes sender;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
    }
    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }
    struct EVMExtraArgsV1 {
        uint256 gasLimit;
        bool strict;
    }
}
