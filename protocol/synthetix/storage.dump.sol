// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

// @custom:artifact @synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol:OwnableStorage
library OwnableStorage {
    struct Data {
        address owner;
        address nominatedOwner;
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/proxy/ProxyStorage.sol:ProxyStorage
contract ProxyStorage {
    struct ProxyStore {
        address implementation;
        bool simulatingUpgrade;
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC20Storage.sol:ERC20Storage
library ERC20Storage {
    struct Data {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => uint256) balanceOf;
        mapping(address => mapping(address => uint256)) allowance;
        uint256 totalSupply;
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC721EnumerableStorage.sol:ERC721EnumerableStorage
library ERC721EnumerableStorage {
    struct Data {
        mapping(uint256 => uint256) ownedTokensIndex;
        mapping(uint256 => uint256) allTokensIndex;
        mapping(address => mapping(uint256 => uint256)) ownedTokens;
        uint256[] allTokens;
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC721Storage.sol:ERC721Storage
library ERC721Storage {
    struct Data {
        string name;
        string symbol;
        string baseTokenURI;
        mapping(uint256 => address) ownerOf;
        mapping(address => uint256) balanceOf;
        mapping(uint256 => address) tokenApprovals;
        mapping(address => mapping(address => bool)) operatorApprovals;
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/utils/HeapUtil.sol:HeapUtil
library HeapUtil {
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
        bytes32[] raw___values;
        mapping(bytes32 => uint256) raw___positions;
    }
    struct AddressSet {
        bytes32[] raw___values;
        mapping(bytes32 => uint256) raw___positions;
    }
    struct Bytes32Set {
        bytes32[] _values;
        mapping(bytes32 => uint256) _positions;
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/AssociatedSystem.sol:AssociatedSystem
library AssociatedSystem {
    struct Data {
        address proxy;
        address impl;
        bytes32 kind;
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/FeatureFlag.sol:FeatureFlag
library FeatureFlag {
    struct Data {
        bytes32 name;
        bool allowAll;
        bool denyAll;
        bytes32[] permissionedAddresses__raw___values;
        mapping(bytes32 => uint256) permissionedAddresses__raw___positions;
        address[] deniers;
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/Initialized.sol:Initialized
library Initialized {
    struct Data {
        bool initialized;
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
        int64 price__price;
        uint64 price__conf;
        int32 price__expo;
        uint256 price__publishTime;
        int64 emaPrice__price;
        uint64 emaPrice__conf;
        int32 emaPrice__expo;
        uint256 emaPrice__publishTime;
    }
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

// @custom:artifact contracts/storage/Account.sol:Account
library Account {
    struct Data {
        uint128 id;
        address rbac__owner;
        mapping(address => SetUtil.Bytes32Set) rbac__permissions;
        bytes32[] rbac__permissionAddresses__raw___values;
        mapping(bytes32 => uint256) rbac__permissionAddresses__raw___positions;
        uint64 lastInteraction;
        uint64 __slotAvailableForFutureUse;
        uint128 __slot2AvailableForFutureUse;
        mapping(address => Collateral.Data) collaterals;
    }
}

// @custom:artifact contracts/storage/AccountRBAC.sol:AccountRBAC
library AccountRBAC {
    struct Data {
        address owner;
        mapping(address => SetUtil.Bytes32Set) permissions;
        bytes32[] permissionAddresses__raw___values;
        mapping(bytes32 => uint256) permissionAddresses__raw___positions;
    }
}

// @custom:artifact contracts/storage/Collateral.sol:Collateral
library Collateral {
    struct Data {
        uint256 amountAvailableForDelegationD18;
        bytes32[] pools__raw___values;
        mapping(bytes32 => uint256) pools__raw___positions;
        CollateralLock.Data[] locks;
    }
}

// @custom:artifact contracts/storage/CollateralConfiguration.sol:CollateralConfiguration
library CollateralConfiguration {
    struct Data {
        bool depositingEnabled;
        uint256 issuanceRatioD18;
        uint256 liquidationRatioD18;
        uint256 liquidationRewardD18;
        bytes32 oracleNodeId;
        address tokenAddress;
        uint256 minDelegationD18;
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
    struct Data {
        address ccipRouter;
        bytes32[] supportedNetworks__raw___values;
        mapping(bytes32 => uint256) supportedNetworks__raw___positions;
        mapping(uint64 => uint64) ccipChainIdToSelector;
        mapping(uint64 => uint64) ccipSelectorToChainId;
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
        uint128 inRangePools__idCount;
        Node[] inRangePools__nodes;
        mapping(uint128 => uint256) inRangePools__indices;
        uint128 outRangePools__idCount;
        Node[] outRangePools__nodes;
        mapping(uint128 => uint256) outRangePools__indices;
        uint128 poolsDebtDistribution__totalSharesD18;
        int128 poolsDebtDistribution__valuePerShareD27;
        mapping(bytes32 => DistributionActor.Data) poolsDebtDistribution__actorInfo;
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
    struct Data {
        mapping(address => uint128[]) marketIdsForAddress;
        uint128 lastCreatedMarketId;
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
    struct Data {
        address oracleManagerAddress;
    }
}

// @custom:artifact contracts/storage/Pool.sol:Pool
library Pool {
    struct Data {
        uint128 id;
        string name;
        address owner;
        address nominatedOwner;
        uint128 totalWeightsD18;
        int128 totalVaultDebtsD18;
        MarketConfiguration.Data[] marketConfigurations;
        uint128 vaultsDebtDistribution__totalSharesD18;
        int128 vaultsDebtDistribution__valuePerShareD27;
        mapping(bytes32 => DistributionActor.Data) vaultsDebtDistribution__actorInfo;
        mapping(address => Vault.Data) vaults;
        uint64 lastConfigurationTime;
        uint64 __reserved1;
        uint64 __reserved2;
        uint64 __reserved3;
        mapping(address => PoolCollateralConfiguration.Data) collateralConfigurations;
        bool collateralDisabledByDefault;
    }
}

// @custom:artifact contracts/storage/PoolCollateralConfiguration.sol:PoolCollateralConfiguration
library PoolCollateralConfiguration {
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
    struct Data {
        uint64 accountIdOffset;
    }
}

// @custom:artifact contracts/storage/SystemPoolConfiguration.sol:SystemPoolConfiguration
library SystemPoolConfiguration {
    struct Data {
        uint256 minLiquidityRatioD18;
        uint128 __reservedForFutureUse;
        uint128 preferredPool;
        bytes32[] approvedPools__raw___values;
        mapping(bytes32 => uint256) approvedPools__raw___positions;
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
        bytes32[] rewardIds___values;
        mapping(bytes32 => uint256) rewardIds___positions;
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
        uint128 accountsDebtDistribution__totalSharesD18;
        int128 accountsDebtDistribution__valuePerShareD27;
        mapping(bytes32 => DistributionActor.Data) accountsDebtDistribution__actorInfo;
        uint128 collateralAmounts__totalSharesD18;
        int128 collateralAmounts__scaleModifierD27;
        mapping(bytes32 => uint256) collateralAmounts__sharesD18;
        mapping(uint256 => int256) consolidatedDebtAmountsD18;
        mapping(uint128 => uint64) lastDelegationTime;
    }
}

// @custom:artifact contracts/utils/CcipClient.sol:CcipClient
library CcipClient {
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
