// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// @custom:artifact @synthetixio/core-contracts/contracts/ownership/AuthorizableStorage.sol:AuthorizableStorage
library AuthorizableStorage {
    struct Data {
        address authorized;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Authorizable"));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol:OwnableStorage
library OwnableStorage {
    struct Data {
        bool initialized;
        address owner;
        address nominatedOwner;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Ownable"));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/proxy/ProxyStorage.sol:ProxyStorage
contract ProxyStorage {
    struct ProxyStore {
        address implementation;
        bool simulatingUpgrade;
    }
    function _proxyStore() internal pure returns (ProxyStore storage store) {
        assembly {
            store.slot := 0x32402780481dd8149e50baad867f01da72e2f7d02639a6fe378dbd80b6bb446e
        }
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
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC20"));
        assembly {
            store.slot := s
        }
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
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC721Enumerable"));
        assembly {
            store.slot := s
        }
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
    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ERC721"));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/utils/HeapUtil.sol:HeapUtil
library HeapUtil {
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
    struct Data {
        address proxy;
        address impl;
        bytes32 kind;
    }
    function load(bytes32 id) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("AssociatedSystem", id));
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
        bytes32 s = keccak256(abi.encode("FeatureFlag", featureName));
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
        bytes32 s = keccak256(abi.encode("Initialized", id));
        assembly {
            store.slot := s
        }
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
    struct LiquidationInformation {
        CurvesLibrary.PolynomialCurve curve;
        mapping(uint => uint) initialAmount;
        uint accumulated;
    }
}

// @custom:artifact contracts/interfaces/external/IEVM2AnySubscriptionOnRampRouterInterface.sol:IEVM2AnySubscriptionOnRampRouterInterface
interface IEVM2AnySubscriptionOnRampRouterInterface {
    struct EVM2AnySubscriptionMessage {
        bytes receiver;
        bytes data;
        address[] tokens;
        uint256[] amounts;
        uint256 gasLimit;
    }
}

// @custom:artifact contracts/modules/test/TestableAccountRBACModule.sol:TestableAccountRBACModule
contract TestableAccountRBACModule {
    function _getInstanceStore() internal pure returns (AccountRBAC.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableAccountRBAC"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableCollateralLockModule.sol:TestableCollateralLockModule
contract TestableCollateralLockModule {
    function _getInstanceStore() internal pure returns (CollateralLock.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableCollateralLock"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableCollateralModule.sol:TestableCollateralModule
contract TestableCollateralModule {
    function _getInstanceStore() internal pure returns (Collateral.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableCollateral"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableDistributionActorModule.sol:TestableDistributionActorModule
contract TestableDistributionActorModule {
    function _getInstanceStore() internal pure returns (DistributionActor.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableDistributionActor"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableDistributionEntryModule.sol:TestableDistributionEntryModule
contract TestableDistributionEntryModule {
    function _getInstanceStore() internal pure returns (DistributionEntry.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableDistributionEntry"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableDistributionModule.sol:TestableDistributionModule
contract TestableDistributionModule {
    function _getInstanceStore() internal pure returns (Distribution.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableDistribution"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableMarketConfigurationModule.sol:TestableMarketConfigurationModule
contract TestableMarketConfigurationModule {
    function _getInstanceStore() internal pure returns (MarketConfiguration.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableMarketConfiguration"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestablePoolConfigurationModule.sol:TestablePoolConfigurationModule
contract TestablePoolConfigurationModule {
    function _getInstanceStore() internal pure returns (PoolConfiguration.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestablePoolConfiguration"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableRewardDistributionModule.sol:TestableRewardDistributionModule
contract TestableRewardDistributionModule {
    function _getInstanceStore() internal pure returns (RewardDistribution.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableRewardDistribution"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableRewardDistributionStatusModule.sol:TestableRewardDistributionStatusModule
contract TestableRewardDistributionStatusModule {
    function _getInstanceStore() internal pure returns (RewardDistributionStatus.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableRewardDistributionStatus"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableVaultEpochModule.sol:TestableVaultEpochModule
contract TestableVaultEpochModule {
    function _getInstanceStore() internal pure returns (VaultEpoch.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableVaultEpoch"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/modules/test/TestableVaultModule.sol:TestableVaultModule
contract TestableVaultModule {
    function _getInstanceStore() internal pure returns (Vault.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableVault"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Account.sol:Account
library Account {
    struct Data {
        uint128 id;
        AccountRBAC.Data rbac;
        SetUtil.AddressSet activeCollaterals;
        mapping(address => Collateral.Data) collaterals;
    }
    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Account", id));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/storage/AccountRBAC.sol:AccountRBAC
library AccountRBAC {
    struct Data {
        address owner;
        mapping(address => SetUtil.Bytes32Set) permissions;
        SetUtil.AddressSet permissionAddresses;
    }
}

// @custom:artifact contracts/storage/Collateral.sol:Collateral
library Collateral {
    struct Data {
        bool isSet;
        uint256 availableAmount;
        SetUtil.UintSet pools;
        CollateralLock.Data[] locks;
    }
}

// @custom:artifact contracts/storage/CollateralConfiguration.sol:CollateralConfiguration
library CollateralConfiguration {
    struct Data {
        bool depositingEnabled;
        uint targetCRatio;
        uint minimumCRatio;
        uint liquidationReward;
        address priceFeed;
        address tokenAddress;
    }
    function load(address token) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("CollateralConfiguration", token));
        assembly {
            data.slot := s
        }
    }
    function loadAvailableCollaterals() internal pure returns (SetUtil.AddressSet storage data) {
        bytes32 s = keccak256(abi.encode("CollateralConfiguration_availableCollaterals"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/storage/CollateralLock.sol:CollateralLock
library CollateralLock {
    struct Data {
        uint256 amount;
        uint64 lockExpirationTime;
    }
}

// @custom:artifact contracts/storage/Distribution.sol:Distribution
library Distribution {
    struct Data {
        uint128 totalShares;
        int128 valuePerShare;
        mapping(bytes32 => DistributionActor.Data) actorInfo;
    }
}

// @custom:artifact contracts/storage/DistributionActor.sol:DistributionActor
library DistributionActor {
    struct Data {
        uint128 shares;
        int128 lastValuePerShare;
    }
}

// @custom:artifact contracts/storage/DistributionEntry.sol:DistributionEntry
library DistributionEntry {
    struct Data {
        int128 scheduledValue;
        int64 start;
        int32 duration;
        int32 lastUpdate;
    }
}

// @custom:artifact contracts/storage/Market.sol:Market
library Market {
    struct Data {
        uint128 id;
        address marketAddress;
        int128 issuance;
        uint128 capacity;
        int128 lastDistributedMarketBalance;
        HeapUtil.Data inRangePools;
        HeapUtil.Data outRangePools;
        Distribution.Data debtDist;
        mapping(uint128 => int) poolPendingDebt;
        DepositedCollateral[] depositedCollateral;
        mapping(address => uint) maximumDepositable;
    }
    struct DepositedCollateral {
        address collateralType;
        uint amount;
    }
    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Market", id));
        assembly {
            data.slot := s
        }
    }
    function loadIdsByAddress(address addr) internal pure returns (uint[] storage data) {
        bytes32 s = keccak256(abi.encode("Market_idsByAddress", addr));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/storage/MarketConfiguration.sol:MarketConfiguration
library MarketConfiguration {
    struct Data {
        uint128 market;
        uint128 weight;
        int128 maxDebtShareValue;
    }
}

// @custom:artifact contracts/storage/Pool.sol:Pool
library Pool {
    struct Data {
        uint128 id;
        string name;
        address owner;
        address nominatedOwner;
        uint128 totalWeights;
        uint128 unusedCreditCapacity;
        MarketConfiguration.Data[] marketConfigurations;
        Distribution.Data debtDist;
        SetUtil.AddressSet collateralTypes;
        mapping(address => Vault.Data) vaults;
    }
    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Pool", id));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/storage/PoolConfiguration.sol:PoolConfiguration
library PoolConfiguration {
    struct Data {
        uint minLiquidityRatio;
        uint preferredPool;
        SetUtil.UintSet approvedPools;
    }
    function load() internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("PoolConfiguration"));
        assembly {
            data.slot := s
        }
    }
}

// @custom:artifact contracts/storage/RewardDistribution.sol:RewardDistribution
library RewardDistribution {
    struct Data {
        address distributor;
        DistributionEntry.Data entry;
        uint128 rewardPerShare;
        mapping(uint256 => RewardDistributionStatus.Data) actorInfo;
    }
}

// @custom:artifact contracts/storage/RewardDistributionStatus.sol:RewardDistributionStatus
library RewardDistributionStatus {
    struct Data {
        uint128 lastRewardPerShare;
        uint128 pendingSend;
    }
}

// @custom:artifact contracts/storage/Vault.sol:Vault
library Vault {
    struct Data {
        uint epoch;
        uint128 unused_;
        uint128 prevRemainingLiquidity;
        mapping(uint => VaultEpoch.Data) epochData;
        mapping(bytes32 => RewardDistribution.Data) rewards;
        SetUtil.Bytes32Set rewardIds;
    }
}

// @custom:artifact contracts/storage/VaultEpoch.sol:VaultEpoch
library VaultEpoch {
    struct Data {
        int128 unconsolidatedDebt;
        Distribution.Data incomingDebtDist;
        Distribution.Data collateralDist;
        Distribution.Data consolidatedDebtDist;
    }
}

// @custom:artifact contracts/utils/CurvesLibrary.sol:CurvesLibrary
library CurvesLibrary {
    struct PolynomialCurve {
        uint start;
        uint end;
        int a;
        int b;
        int c;
    }
    struct Point {
        uint x;
        uint y;
    }
}
