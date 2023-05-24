# Solidity API

## TestableAccountRBACStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct AccountRBAC.Data data)
  ```

#### AccountRBAC_set_owner

  ```solidity
  function AccountRBAC_set_owner(address val) external
  ```

#### AccountRBAC_get_owner

  ```solidity
  function AccountRBAC_get_owner() external view returns (address)
  ```

#### AccountRBAC_isPermissionValid

  ```solidity
  function AccountRBAC_isPermissionValid(bytes32 permission) external pure
  ```

#### AccountRBAC_setOwner

  ```solidity
  function AccountRBAC_setOwner(address owner) external
  ```

#### AccountRBAC_grantPermission

  ```solidity
  function AccountRBAC_grantPermission(bytes32 permission, address target) external
  ```

#### AccountRBAC_revokePermission

  ```solidity
  function AccountRBAC_revokePermission(bytes32 permission, address target) external
  ```

#### AccountRBAC_revokeAllPermissions

  ```solidity
  function AccountRBAC_revokeAllPermissions(address target) external
  ```

#### AccountRBAC_hasPermission

  ```solidity
  function AccountRBAC_hasPermission(bytes32 permission, address target) external view returns (bool)
  ```

#### AccountRBAC_authorized

  ```solidity
  function AccountRBAC_authorized(bytes32 permission, address target) external view returns (bool)
  ```

### Events

## TestableAccountStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore(uint128 _load_id) internal pure returns (struct Account.Data)
  ```

#### Account_set_id

  ```solidity
  function Account_set_id(uint128 _load_id, uint128 val) external
  ```

#### Account_get_id

  ```solidity
  function Account_get_id(uint128 _load_id) external view returns (uint128)
  ```

#### Account_set_lastInteraction

  ```solidity
  function Account_set_lastInteraction(uint128 _load_id, uint64 val) external
  ```

#### Account_get_lastInteraction

  ```solidity
  function Account_get_lastInteraction(uint128 _load_id) external view returns (uint64)
  ```

#### Account_set___slotAvailableForFutureUse

  ```solidity
  function Account_set___slotAvailableForFutureUse(uint128 _load_id, uint64 val) external
  ```

#### Account_get___slotAvailableForFutureUse

  ```solidity
  function Account_get___slotAvailableForFutureUse(uint128 _load_id) external view returns (uint64)
  ```

#### Account_set___slot2AvailableForFutureUse

  ```solidity
  function Account_set___slot2AvailableForFutureUse(uint128 _load_id, uint128 val) external
  ```

#### Account_get___slot2AvailableForFutureUse

  ```solidity
  function Account_get___slot2AvailableForFutureUse(uint128 _load_id) external view returns (uint128)
  ```

#### Account_getCollateralTotals

  ```solidity
  function Account_getCollateralTotals(uint128 _load_id, address collateralType) external view returns (uint256, uint256, uint256)
  ```

#### Account_getAssignedCollateral

  ```solidity
  function Account_getAssignedCollateral(uint128 _load_id, address collateralType) external view returns (uint256)
  ```

#### Account_recordInteraction

  ```solidity
  function Account_recordInteraction(uint128 _load_id) external
  ```

#### Account_requireSufficientCollateral

  ```solidity
  function Account_requireSufficientCollateral(uint128 _load_id, uint128 accountId, address collateralType, uint256 amountD18) external view
  ```

### Events

## TestableCollateralConfigurationStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore(address _load_token) internal pure returns (struct CollateralConfiguration.Data)
  ```

#### CollateralConfiguration_set_depositingEnabled

  ```solidity
  function CollateralConfiguration_set_depositingEnabled(address _load_token, bool val) external
  ```

#### CollateralConfiguration_get_depositingEnabled

  ```solidity
  function CollateralConfiguration_get_depositingEnabled(address _load_token) external view returns (bool)
  ```

#### CollateralConfiguration_set_issuanceRatioD18

  ```solidity
  function CollateralConfiguration_set_issuanceRatioD18(address _load_token, uint256 val) external
  ```

#### CollateralConfiguration_get_issuanceRatioD18

  ```solidity
  function CollateralConfiguration_get_issuanceRatioD18(address _load_token) external view returns (uint256)
  ```

#### CollateralConfiguration_set_liquidationRatioD18

  ```solidity
  function CollateralConfiguration_set_liquidationRatioD18(address _load_token, uint256 val) external
  ```

#### CollateralConfiguration_get_liquidationRatioD18

  ```solidity
  function CollateralConfiguration_get_liquidationRatioD18(address _load_token) external view returns (uint256)
  ```

#### CollateralConfiguration_set_liquidationRewardD18

  ```solidity
  function CollateralConfiguration_set_liquidationRewardD18(address _load_token, uint256 val) external
  ```

#### CollateralConfiguration_get_liquidationRewardD18

  ```solidity
  function CollateralConfiguration_get_liquidationRewardD18(address _load_token) external view returns (uint256)
  ```

#### CollateralConfiguration_set_oracleNodeId

  ```solidity
  function CollateralConfiguration_set_oracleNodeId(address _load_token, bytes32 val) external
  ```

#### CollateralConfiguration_get_oracleNodeId

  ```solidity
  function CollateralConfiguration_get_oracleNodeId(address _load_token) external view returns (bytes32)
  ```

#### CollateralConfiguration_set_tokenAddress

  ```solidity
  function CollateralConfiguration_set_tokenAddress(address _load_token, address val) external
  ```

#### CollateralConfiguration_get_tokenAddress

  ```solidity
  function CollateralConfiguration_get_tokenAddress(address _load_token) external view returns (address)
  ```

#### CollateralConfiguration_set_minDelegationD18

  ```solidity
  function CollateralConfiguration_set_minDelegationD18(address _load_token, uint256 val) external
  ```

#### CollateralConfiguration_get_minDelegationD18

  ```solidity
  function CollateralConfiguration_get_minDelegationD18(address _load_token) external view returns (uint256)
  ```

#### CollateralConfiguration_set

  ```solidity
  function CollateralConfiguration_set(address _load_token, struct CollateralConfiguration.Data config) external
  ```

#### CollateralConfiguration_collateralEnabled

  ```solidity
  function CollateralConfiguration_collateralEnabled(address _load_token, address token) external view
  ```

#### CollateralConfiguration_requireSufficientDelegation

  ```solidity
  function CollateralConfiguration_requireSufficientDelegation(address _load_token, address token, uint256 amountD18) external view
  ```

#### CollateralConfiguration_getCollateralPrice

  ```solidity
  function CollateralConfiguration_getCollateralPrice(address _load_token) external view returns (uint256)
  ```

#### CollateralConfiguration_verifyIssuanceRatio

  ```solidity
  function CollateralConfiguration_verifyIssuanceRatio(address _load_token, uint256 debtD18, uint256 collateralValueD18) external view
  ```

#### CollateralConfiguration_convertTokenToSystemAmount

  ```solidity
  function CollateralConfiguration_convertTokenToSystemAmount(address _load_token, uint256 tokenAmount) external view returns (uint256)
  ```

### Events

## TestableCollateralLockStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct CollateralLock.Data data)
  ```

#### CollateralLock_set_amountD18

  ```solidity
  function CollateralLock_set_amountD18(uint128 val) external
  ```

#### CollateralLock_get_amountD18

  ```solidity
  function CollateralLock_get_amountD18() external view returns (uint128)
  ```

#### CollateralLock_set_lockExpirationTime

  ```solidity
  function CollateralLock_set_lockExpirationTime(uint64 val) external
  ```

#### CollateralLock_get_lockExpirationTime

  ```solidity
  function CollateralLock_get_lockExpirationTime() external view returns (uint64)
  ```

### Events

## TestableCollateralStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct Collateral.Data data)
  ```

#### Collateral_set_amountAvailableForDelegationD18

  ```solidity
  function Collateral_set_amountAvailableForDelegationD18(uint256 val) external
  ```

#### Collateral_get_amountAvailableForDelegationD18

  ```solidity
  function Collateral_get_amountAvailableForDelegationD18() external view returns (uint256)
  ```

#### Collateral_increaseAvailableCollateral

  ```solidity
  function Collateral_increaseAvailableCollateral(uint256 amountD18) external
  ```

#### Collateral_decreaseAvailableCollateral

  ```solidity
  function Collateral_decreaseAvailableCollateral(uint256 amountD18) external
  ```

#### Collateral_getTotalLocked

  ```solidity
  function Collateral_getTotalLocked() external view returns (uint256)
  ```

### Events

## TestableConfigStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct Config.Data data)
  ```

#### Config_set___unused

  ```solidity
  function Config_set___unused(uint256 val) external
  ```

#### Config_get___unused

  ```solidity
  function Config_get___unused() external view returns (uint256)
  ```

#### Config_read

  ```solidity
  function Config_read(bytes32 k, bytes32 zeroValue) external view returns (bytes32)
  ```

#### Config_readUint

  ```solidity
  function Config_readUint(bytes32 k, uint256 zeroValue) external view returns (uint256)
  ```

#### Config_readAddress

  ```solidity
  function Config_readAddress(bytes32 k, address zeroValue) external view returns (address)
  ```

#### Config_put

  ```solidity
  function Config_put(bytes32 k, bytes32 v) external
  ```

### Events

## TestableDistributionActorStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct DistributionActor.Data data)
  ```

#### DistributionActor_set_sharesD18

  ```solidity
  function DistributionActor_set_sharesD18(uint128 val) external
  ```

#### DistributionActor_get_sharesD18

  ```solidity
  function DistributionActor_get_sharesD18() external view returns (uint128)
  ```

#### DistributionActor_set_lastValuePerShareD27

  ```solidity
  function DistributionActor_set_lastValuePerShareD27(int128 val) external
  ```

#### DistributionActor_get_lastValuePerShareD27

  ```solidity
  function DistributionActor_get_lastValuePerShareD27() external view returns (int128)
  ```

### Events

## TestableDistributionStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct Distribution.Data data)
  ```

#### Distribution_set_totalSharesD18

  ```solidity
  function Distribution_set_totalSharesD18(uint128 val) external
  ```

#### Distribution_get_totalSharesD18

  ```solidity
  function Distribution_get_totalSharesD18() external view returns (uint128)
  ```

#### Distribution_set_valuePerShareD27

  ```solidity
  function Distribution_set_valuePerShareD27(int128 val) external
  ```

#### Distribution_get_valuePerShareD27

  ```solidity
  function Distribution_get_valuePerShareD27() external view returns (int128)
  ```

#### Distribution_distributeValue

  ```solidity
  function Distribution_distributeValue(int256 valueD18) external
  ```

#### Distribution_setActorShares

  ```solidity
  function Distribution_setActorShares(bytes32 actorId, uint256 newActorSharesD18) external returns (int256)
  ```

#### Distribution_accumulateActor

  ```solidity
  function Distribution_accumulateActor(bytes32 actorId) external returns (int256)
  ```

#### Distribution_getActorValueChange

  ```solidity
  function Distribution_getActorValueChange(bytes32 actorId) external view returns (int256)
  ```

#### Distribution_getActorShares

  ```solidity
  function Distribution_getActorShares(bytes32 actorId) external view returns (uint256)
  ```

#### Distribution_getValuePerShare

  ```solidity
  function Distribution_getValuePerShare() external view returns (int256)
  ```

### Events

## TestableMarketConfigurationStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct MarketConfiguration.Data data)
  ```

#### MarketConfiguration_set_marketId

  ```solidity
  function MarketConfiguration_set_marketId(uint128 val) external
  ```

#### MarketConfiguration_get_marketId

  ```solidity
  function MarketConfiguration_get_marketId() external view returns (uint128)
  ```

#### MarketConfiguration_set_weightD18

  ```solidity
  function MarketConfiguration_set_weightD18(uint128 val) external
  ```

#### MarketConfiguration_get_weightD18

  ```solidity
  function MarketConfiguration_get_weightD18() external view returns (uint128)
  ```

#### MarketConfiguration_set_maxDebtShareValueD18

  ```solidity
  function MarketConfiguration_set_maxDebtShareValueD18(int128 val) external
  ```

#### MarketConfiguration_get_maxDebtShareValueD18

  ```solidity
  function MarketConfiguration_get_maxDebtShareValueD18() external view returns (int128)
  ```

### Events

## TestableMarketCreatorStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct MarketCreator.Data data)
  ```

#### MarketCreator_set_lastCreatedMarketId

  ```solidity
  function MarketCreator_set_lastCreatedMarketId(uint128 val) external
  ```

#### MarketCreator_get_lastCreatedMarketId

  ```solidity
  function MarketCreator_get_lastCreatedMarketId() external view returns (uint128)
  ```

### Events

## TestableMarketPoolInfoStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct MarketPoolInfo.Data data)
  ```

#### MarketPoolInfo_set_creditCapacityAmountD18

  ```solidity
  function MarketPoolInfo_set_creditCapacityAmountD18(uint128 val) external
  ```

#### MarketPoolInfo_get_creditCapacityAmountD18

  ```solidity
  function MarketPoolInfo_get_creditCapacityAmountD18() external view returns (uint128)
  ```

#### MarketPoolInfo_set_pendingDebtD18

  ```solidity
  function MarketPoolInfo_set_pendingDebtD18(uint128 val) external
  ```

#### MarketPoolInfo_get_pendingDebtD18

  ```solidity
  function MarketPoolInfo_get_pendingDebtD18() external view returns (uint128)
  ```

### Events

## TestableMarketStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore(uint128 _load_id) internal pure returns (struct Market.Data)
  ```

#### Market_set_id

  ```solidity
  function Market_set_id(uint128 _load_id, uint128 val) external
  ```

#### Market_get_id

  ```solidity
  function Market_get_id(uint128 _load_id) external view returns (uint128)
  ```

#### Market_set_marketAddress

  ```solidity
  function Market_set_marketAddress(uint128 _load_id, address val) external
  ```

#### Market_get_marketAddress

  ```solidity
  function Market_get_marketAddress(uint128 _load_id) external view returns (address)
  ```

#### Market_set_netIssuanceD18

  ```solidity
  function Market_set_netIssuanceD18(uint128 _load_id, int128 val) external
  ```

#### Market_get_netIssuanceD18

  ```solidity
  function Market_get_netIssuanceD18(uint128 _load_id) external view returns (int128)
  ```

#### Market_set_creditCapacityD18

  ```solidity
  function Market_set_creditCapacityD18(uint128 _load_id, int128 val) external
  ```

#### Market_get_creditCapacityD18

  ```solidity
  function Market_get_creditCapacityD18(uint128 _load_id) external view returns (int128)
  ```

#### Market_set_lastDistributedMarketBalanceD18

  ```solidity
  function Market_set_lastDistributedMarketBalanceD18(uint128 _load_id, int128 val) external
  ```

#### Market_get_lastDistributedMarketBalanceD18

  ```solidity
  function Market_get_lastDistributedMarketBalanceD18(uint128 _load_id) external view returns (int128)
  ```

#### Market_set_minDelegateTime

  ```solidity
  function Market_set_minDelegateTime(uint128 _load_id, uint32 val) external
  ```

#### Market_get_minDelegateTime

  ```solidity
  function Market_get_minDelegateTime(uint128 _load_id) external view returns (uint32)
  ```

#### Market_set___reservedForLater1

  ```solidity
  function Market_set___reservedForLater1(uint128 _load_id, uint32 val) external
  ```

#### Market_get___reservedForLater1

  ```solidity
  function Market_get___reservedForLater1(uint128 _load_id) external view returns (uint32)
  ```

#### Market_set___reservedForLater2

  ```solidity
  function Market_set___reservedForLater2(uint128 _load_id, uint64 val) external
  ```

#### Market_get___reservedForLater2

  ```solidity
  function Market_get___reservedForLater2(uint128 _load_id) external view returns (uint64)
  ```

#### Market_set___reservedForLater3

  ```solidity
  function Market_set___reservedForLater3(uint128 _load_id, uint64 val) external
  ```

#### Market_get___reservedForLater3

  ```solidity
  function Market_get___reservedForLater3(uint128 _load_id) external view returns (uint64)
  ```

#### Market_set___reservedForLater4

  ```solidity
  function Market_set___reservedForLater4(uint128 _load_id, uint64 val) external
  ```

#### Market_get___reservedForLater4

  ```solidity
  function Market_get___reservedForLater4(uint128 _load_id) external view returns (uint64)
  ```

#### Market_set_minLiquidityRatioD18

  ```solidity
  function Market_set_minLiquidityRatioD18(uint128 _load_id, uint256 val) external
  ```

#### Market_get_minLiquidityRatioD18

  ```solidity
  function Market_get_minLiquidityRatioD18(uint128 _load_id) external view returns (uint256)
  ```

#### Market_set_maximumDepositableD18

  ```solidity
  function Market_set_maximumDepositableD18(uint128 _load_id, address idx, uint256 val) external
  ```

#### Market_get_maximumDepositableD18

  ```solidity
  function Market_get_maximumDepositableD18(uint128 _load_id, address idx) external view returns (uint256)
  ```

#### Market_getReportedDebt

  ```solidity
  function Market_getReportedDebt(uint128 _load_id) external view returns (uint256)
  ```

#### Market_getLockedCreditCapacity

  ```solidity
  function Market_getLockedCreditCapacity(uint128 _load_id) external view returns (uint256)
  ```

#### Market_totalDebt

  ```solidity
  function Market_totalDebt(uint128 _load_id) external view returns (int256)
  ```

#### Market_getDepositedCollateralValue

  ```solidity
  function Market_getDepositedCollateralValue(uint128 _load_id) external view returns (uint256)
  ```

#### Market_getPoolCreditCapacity

  ```solidity
  function Market_getPoolCreditCapacity(uint128 _load_id, uint128 poolId) external view returns (uint256)
  ```

#### Market_getCreditCapacityContribution

  ```solidity
  function Market_getCreditCapacityContribution(uint128 _load_id, uint256 creditCapacitySharesD18, int256 maxShareValueD18) external view returns (int256)
  ```

#### Market_isCapacityLocked

  ```solidity
  function Market_isCapacityLocked(uint128 _load_id) external view returns (bool)
  ```

#### Market__testOnly_getOutstandingDebt

  ```solidity
  function Market__testOnly_getOutstandingDebt(uint128 _load_id, uint128 poolId) external returns (int256)
  ```

#### Market__testOnly_inRangePools

  ```solidity
  function Market__testOnly_inRangePools(uint128 _load_id) external view returns (uint256)
  ```

#### Market__testOnly_outRangePools

  ```solidity
  function Market__testOnly_outRangePools(uint128 _load_id) external view returns (uint256)
  ```

#### Market_getDebtPerShare

  ```solidity
  function Market_getDebtPerShare(uint128 _load_id) external view returns (int256)
  ```

#### Market_rebalancePools

  ```solidity
  function Market_rebalancePools(uint128 _load_id, uint128 marketId, uint128 poolId, int256 maxDebtShareValueD18, uint256 newCreditCapacityD18) external returns (int256)
  ```

#### Market_adjustPoolShares

  ```solidity
  function Market_adjustPoolShares(uint128 _load_id, uint128 poolId, uint256 newCreditCapacityD18, int256 newPoolMaxShareValueD18) external returns (int256)
  ```

#### Market_distributeDebtToPools

  ```solidity
  function Market_distributeDebtToPools(uint128 _load_id, uint256 maxIter) external returns (bool)
  ```

#### Market_getTargetValuePerShare

  ```solidity
  function Market_getTargetValuePerShare(uint128 _load_id, int256 valueToDistributeD18) external view returns (int256)
  ```

#### Market_bumpPools

  ```solidity
  function Market_bumpPools(uint128 _load_id, int256 maxDistributedD18, uint256 maxIter) external returns (int256, bool)
  ```

### Events

## TestableOracleManagerStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct OracleManager.Data data)
  ```

#### OracleManager_set_oracleManagerAddress

  ```solidity
  function OracleManager_set_oracleManagerAddress(address val) external
  ```

#### OracleManager_get_oracleManagerAddress

  ```solidity
  function OracleManager_get_oracleManagerAddress() external view returns (address)
  ```

### Events

## TestablePoolStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore(uint128 _load_id) internal pure returns (struct Pool.Data)
  ```

#### Pool_set_id

  ```solidity
  function Pool_set_id(uint128 _load_id, uint128 val) external
  ```

#### Pool_get_id

  ```solidity
  function Pool_get_id(uint128 _load_id) external view returns (uint128)
  ```

#### Pool_set_name

  ```solidity
  function Pool_set_name(uint128 _load_id, string val) external
  ```

#### Pool_get_name

  ```solidity
  function Pool_get_name(uint128 _load_id) external view returns (string)
  ```

#### Pool_set_owner

  ```solidity
  function Pool_set_owner(uint128 _load_id, address val) external
  ```

#### Pool_get_owner

  ```solidity
  function Pool_get_owner(uint128 _load_id) external view returns (address)
  ```

#### Pool_set_nominatedOwner

  ```solidity
  function Pool_set_nominatedOwner(uint128 _load_id, address val) external
  ```

#### Pool_get_nominatedOwner

  ```solidity
  function Pool_get_nominatedOwner(uint128 _load_id) external view returns (address)
  ```

#### Pool_set_totalWeightsD18

  ```solidity
  function Pool_set_totalWeightsD18(uint128 _load_id, uint128 val) external
  ```

#### Pool_get_totalWeightsD18

  ```solidity
  function Pool_get_totalWeightsD18(uint128 _load_id) external view returns (uint128)
  ```

#### Pool_set_totalVaultDebtsD18

  ```solidity
  function Pool_set_totalVaultDebtsD18(uint128 _load_id, int128 val) external
  ```

#### Pool_get_totalVaultDebtsD18

  ```solidity
  function Pool_get_totalVaultDebtsD18(uint128 _load_id) external view returns (int128)
  ```

#### Pool_set_lastConfigurationTime

  ```solidity
  function Pool_set_lastConfigurationTime(uint128 _load_id, uint64 val) external
  ```

#### Pool_get_lastConfigurationTime

  ```solidity
  function Pool_get_lastConfigurationTime(uint128 _load_id) external view returns (uint64)
  ```

#### Pool_set___reserved1

  ```solidity
  function Pool_set___reserved1(uint128 _load_id, uint64 val) external
  ```

#### Pool_get___reserved1

  ```solidity
  function Pool_get___reserved1(uint128 _load_id) external view returns (uint64)
  ```

#### Pool_set___reserved2

  ```solidity
  function Pool_set___reserved2(uint128 _load_id, uint64 val) external
  ```

#### Pool_get___reserved2

  ```solidity
  function Pool_get___reserved2(uint128 _load_id) external view returns (uint64)
  ```

#### Pool_set___reserved3

  ```solidity
  function Pool_set___reserved3(uint128 _load_id, uint64 val) external
  ```

#### Pool_get___reserved3

  ```solidity
  function Pool_get___reserved3(uint128 _load_id) external view returns (uint64)
  ```

#### Pool_distributeDebtToVaults

  ```solidity
  function Pool_distributeDebtToVaults(uint128 _load_id) external
  ```

#### Pool_getSystemMaxValuePerShare

  ```solidity
  function Pool_getSystemMaxValuePerShare(uint128 _load_id, uint128 marketId, uint256 minLiquidityRatioD18, int256 debtPerShareD18) external view returns (int256)
  ```

#### Pool_hasMarket

  ```solidity
  function Pool_hasMarket(uint128 _load_id, uint128 marketId) external view returns (bool)
  ```

#### Pool_recalculateVaultCollateral

  ```solidity
  function Pool_recalculateVaultCollateral(uint128 _load_id, address collateralType) external returns (uint256)
  ```

#### Pool_updateAccountDebt

  ```solidity
  function Pool_updateAccountDebt(uint128 _load_id, address collateralType, uint128 accountId) external returns (int256)
  ```

#### Pool_resetVault

  ```solidity
  function Pool_resetVault(uint128 _load_id, address collateralType) external
  ```

#### Pool_currentVaultCollateralRatio

  ```solidity
  function Pool_currentVaultCollateralRatio(uint128 _load_id, address collateralType) external returns (uint256)
  ```

#### Pool_getRequiredMinDelegationTime

  ```solidity
  function Pool_getRequiredMinDelegationTime(uint128 _load_id) external view returns (uint32)
  ```

#### Pool_currentVaultDebt

  ```solidity
  function Pool_currentVaultDebt(uint128 _load_id, address collateralType) external returns (int256)
  ```

#### Pool_currentVaultCollateral

  ```solidity
  function Pool_currentVaultCollateral(uint128 _load_id, address collateralType) external view returns (uint256, uint256)
  ```

#### Pool_currentAccountCollateral

  ```solidity
  function Pool_currentAccountCollateral(uint128 _load_id, address collateralType, uint128 accountId) external view returns (uint256, uint256)
  ```

#### Pool_currentAccountCollateralRatio

  ```solidity
  function Pool_currentAccountCollateralRatio(uint128 _load_id, address collateralType, uint128 accountId) external returns (uint256)
  ```

#### Pool_onlyPoolOwner

  ```solidity
  function Pool_onlyPoolOwner(uint128 _load_id, uint128 poolId, address caller) external view
  ```

#### Pool_requireMinDelegationTimeElapsed

  ```solidity
  function Pool_requireMinDelegationTimeElapsed(uint128 _load_id, uint64 lastDelegationTime) external view
  ```

### Events

## TestableRewardDistributionClaimStatusStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct RewardDistributionClaimStatus.Data data)
  ```

#### RewardDistributionClaimStatus_set_lastRewardPerShareD18

  ```solidity
  function RewardDistributionClaimStatus_set_lastRewardPerShareD18(uint128 val) external
  ```

#### RewardDistributionClaimStatus_get_lastRewardPerShareD18

  ```solidity
  function RewardDistributionClaimStatus_get_lastRewardPerShareD18() external view returns (uint128)
  ```

#### RewardDistributionClaimStatus_set_pendingSendD18

  ```solidity
  function RewardDistributionClaimStatus_set_pendingSendD18(uint128 val) external
  ```

#### RewardDistributionClaimStatus_get_pendingSendD18

  ```solidity
  function RewardDistributionClaimStatus_get_pendingSendD18() external view returns (uint128)
  ```

### Events

## TestableRewardDistributionStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct RewardDistribution.Data data)
  ```

#### RewardDistribution_set___slotAvailableForFutureUse

  ```solidity
  function RewardDistribution_set___slotAvailableForFutureUse(uint128 val) external
  ```

#### RewardDistribution_get___slotAvailableForFutureUse

  ```solidity
  function RewardDistribution_get___slotAvailableForFutureUse() external view returns (uint128)
  ```

#### RewardDistribution_set_rewardPerShareD18

  ```solidity
  function RewardDistribution_set_rewardPerShareD18(uint128 val) external
  ```

#### RewardDistribution_get_rewardPerShareD18

  ```solidity
  function RewardDistribution_get_rewardPerShareD18() external view returns (uint128)
  ```

#### RewardDistribution_set_scheduledValueD18

  ```solidity
  function RewardDistribution_set_scheduledValueD18(int128 val) external
  ```

#### RewardDistribution_get_scheduledValueD18

  ```solidity
  function RewardDistribution_get_scheduledValueD18() external view returns (int128)
  ```

#### RewardDistribution_set_start

  ```solidity
  function RewardDistribution_set_start(uint64 val) external
  ```

#### RewardDistribution_get_start

  ```solidity
  function RewardDistribution_get_start() external view returns (uint64)
  ```

#### RewardDistribution_set_duration

  ```solidity
  function RewardDistribution_set_duration(uint32 val) external
  ```

#### RewardDistribution_get_duration

  ```solidity
  function RewardDistribution_get_duration() external view returns (uint32)
  ```

#### RewardDistribution_set_lastUpdate

  ```solidity
  function RewardDistribution_set_lastUpdate(uint32 val) external
  ```

#### RewardDistribution_get_lastUpdate

  ```solidity
  function RewardDistribution_get_lastUpdate() external view returns (uint32)
  ```

#### RewardDistribution_updateEntry

  ```solidity
  function RewardDistribution_updateEntry(uint256 totalSharesAmountD18) external returns (int256)
  ```

### Events

## TestableScalableMappingStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct ScalableMapping.Data data)
  ```

#### ScalableMapping_set_totalSharesD18

  ```solidity
  function ScalableMapping_set_totalSharesD18(uint128 val) external
  ```

#### ScalableMapping_get_totalSharesD18

  ```solidity
  function ScalableMapping_get_totalSharesD18() external view returns (uint128)
  ```

#### ScalableMapping_set_scaleModifierD27

  ```solidity
  function ScalableMapping_set_scaleModifierD27(int128 val) external
  ```

#### ScalableMapping_get_scaleModifierD27

  ```solidity
  function ScalableMapping_get_scaleModifierD27() external view returns (int128)
  ```

#### ScalableMapping_set_sharesD18

  ```solidity
  function ScalableMapping_set_sharesD18(bytes32 idx, uint256 val) external
  ```

#### ScalableMapping_get_sharesD18

  ```solidity
  function ScalableMapping_get_sharesD18(bytes32 idx) external view returns (uint256)
  ```

#### ScalableMapping_scale

  ```solidity
  function ScalableMapping_scale(int256 valueD18) external
  ```

#### ScalableMapping_set

  ```solidity
  function ScalableMapping_set(bytes32 actorId, uint256 newActorValueD18) external returns (uint256)
  ```

#### ScalableMapping_get

  ```solidity
  function ScalableMapping_get(bytes32 actorId) external view returns (uint256)
  ```

#### ScalableMapping_totalAmount

  ```solidity
  function ScalableMapping_totalAmount() external view returns (uint256)
  ```

#### ScalableMapping_getSharesForAmount

  ```solidity
  function ScalableMapping_getSharesForAmount(uint256 amountD18) external view returns (uint256)
  ```

### Events

## TestableSystemAccountConfigurationStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct SystemAccountConfiguration.Data data)
  ```

#### SystemAccountConfiguration_set_accountIdOffset

  ```solidity
  function SystemAccountConfiguration_set_accountIdOffset(uint64 val) external
  ```

#### SystemAccountConfiguration_get_accountIdOffset

  ```solidity
  function SystemAccountConfiguration_get_accountIdOffset() external view returns (uint64)
  ```

### Events

## TestableSystemPoolConfigurationStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct SystemPoolConfiguration.Data data)
  ```

#### SystemPoolConfiguration_set_minLiquidityRatioD18

  ```solidity
  function SystemPoolConfiguration_set_minLiquidityRatioD18(uint256 val) external
  ```

#### SystemPoolConfiguration_get_minLiquidityRatioD18

  ```solidity
  function SystemPoolConfiguration_get_minLiquidityRatioD18() external view returns (uint256)
  ```

#### SystemPoolConfiguration_set___reservedForFutureUse

  ```solidity
  function SystemPoolConfiguration_set___reservedForFutureUse(uint128 val) external
  ```

#### SystemPoolConfiguration_get___reservedForFutureUse

  ```solidity
  function SystemPoolConfiguration_get___reservedForFutureUse() external view returns (uint128)
  ```

#### SystemPoolConfiguration_set_preferredPool

  ```solidity
  function SystemPoolConfiguration_set_preferredPool(uint128 val) external
  ```

#### SystemPoolConfiguration_get_preferredPool

  ```solidity
  function SystemPoolConfiguration_get_preferredPool() external view returns (uint128)
  ```

### Events

## TestableVaultEpochStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct VaultEpoch.Data data)
  ```

#### VaultEpoch_set_unconsolidatedDebtD18

  ```solidity
  function VaultEpoch_set_unconsolidatedDebtD18(int128 val) external
  ```

#### VaultEpoch_get_unconsolidatedDebtD18

  ```solidity
  function VaultEpoch_get_unconsolidatedDebtD18() external view returns (int128)
  ```

#### VaultEpoch_set_totalConsolidatedDebtD18

  ```solidity
  function VaultEpoch_set_totalConsolidatedDebtD18(int128 val) external
  ```

#### VaultEpoch_get_totalConsolidatedDebtD18

  ```solidity
  function VaultEpoch_get_totalConsolidatedDebtD18() external view returns (int128)
  ```

#### VaultEpoch_set_consolidatedDebtAmountsD18

  ```solidity
  function VaultEpoch_set_consolidatedDebtAmountsD18(uint256 idx, int256 val) external
  ```

#### VaultEpoch_get_consolidatedDebtAmountsD18

  ```solidity
  function VaultEpoch_get_consolidatedDebtAmountsD18(uint256 idx) external view returns (int256)
  ```

#### VaultEpoch_set_lastDelegationTime

  ```solidity
  function VaultEpoch_set_lastDelegationTime(uint128 idx, uint64 val) external
  ```

#### VaultEpoch_get_lastDelegationTime

  ```solidity
  function VaultEpoch_get_lastDelegationTime(uint128 idx) external view returns (uint64)
  ```

#### VaultEpoch_distributeDebtToAccounts

  ```solidity
  function VaultEpoch_distributeDebtToAccounts(int256 debtChangeD18) external
  ```

#### VaultEpoch_assignDebtToAccount

  ```solidity
  function VaultEpoch_assignDebtToAccount(uint128 accountId, int256 amountD18) external returns (int256)
  ```

#### VaultEpoch_consolidateAccountDebt

  ```solidity
  function VaultEpoch_consolidateAccountDebt(uint128 accountId) external returns (int256)
  ```

#### VaultEpoch_updateAccountPosition

  ```solidity
  function VaultEpoch_updateAccountPosition(uint128 accountId, uint256 collateralAmountD18, uint256 leverageD18) external
  ```

#### VaultEpoch_totalDebt

  ```solidity
  function VaultEpoch_totalDebt() external view returns (int256)
  ```

#### VaultEpoch_getAccountCollateral

  ```solidity
  function VaultEpoch_getAccountCollateral(uint128 accountId) external view returns (uint256)
  ```

### Events

## TestableVaultStorage

### Functions

#### _getInstanceStore

  ```solidity
  function _getInstanceStore() internal pure returns (struct Vault.Data data)
  ```

#### Vault_set_epoch

  ```solidity
  function Vault_set_epoch(uint256 val) external
  ```

#### Vault_get_epoch

  ```solidity
  function Vault_get_epoch() external view returns (uint256)
  ```

#### Vault_set___slotAvailableForFutureUse

  ```solidity
  function Vault_set___slotAvailableForFutureUse(bytes32 val) external
  ```

#### Vault_get___slotAvailableForFutureUse

  ```solidity
  function Vault_get___slotAvailableForFutureUse() external view returns (bytes32)
  ```

#### Vault_set_prevTotalDebtD18

  ```solidity
  function Vault_set_prevTotalDebtD18(int128 val) external
  ```

#### Vault_get_prevTotalDebtD18

  ```solidity
  function Vault_get_prevTotalDebtD18() external view returns (int128)
  ```

#### Vault_updateCreditCapacity

  ```solidity
  function Vault_updateCreditCapacity(uint256 collateralPriceD18) external returns (uint256, int256, int256)
  ```

#### Vault_distributeDebtToAccounts

  ```solidity
  function Vault_distributeDebtToAccounts(int256 debtChangeD18) external
  ```

#### Vault_consolidateAccountDebt

  ```solidity
  function Vault_consolidateAccountDebt(uint128 accountId) external returns (int256)
  ```

#### Vault_updateRewards

  ```solidity
  function Vault_updateRewards(uint128 accountId, uint128 poolId, address collateralType) external returns (uint256[], address[])
  ```

#### Vault_updateReward

  ```solidity
  function Vault_updateReward(uint128 accountId, uint128 poolId, address collateralType, bytes32 rewardId) external returns (uint256)
  ```

#### Vault_reset

  ```solidity
  function Vault_reset() external
  ```

#### Vault_currentDebt

  ```solidity
  function Vault_currentDebt() external view returns (int256)
  ```

#### Vault_currentCollateral

  ```solidity
  function Vault_currentCollateral() external view returns (uint256)
  ```

#### Vault_currentAccountCollateral

  ```solidity
  function Vault_currentAccountCollateral(uint128 accountId) external view returns (uint256)
  ```

### Events

## Account Module

### Functions

#### getAccountPermissions

  ```solidity
  function getAccountPermissions(uint128 accountId) external view returns (struct IAccountModule.AccountPermissions[] accountPerms)
  ```

  Returns an array of `AccountPermission` for the provided `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose permissions are being retrieved.|

  | Name | Type | Description |
    |accountPerms|struct IAccountModule.AccountPermissions[]|An array of AccountPermission objects describing the permissions granted to the account.|
#### createAccount

  ```solidity
  function createAccount(uint128 requestedAccountId) external
  ```

  Mints an account token with id `requestedAccountId` to `msg.sender`.

  | Name | Type | Description |
    |requestedAccountId|uint128|The id requested for the account being created. Reverts if id already exists. Requirements: - `requestedAccountId` must not already be minted. - `requestedAccountId` must be less than type(uint128).max / 2 Emits a {AccountCreated} event.|

#### createAccount

  ```solidity
  function createAccount() external returns (uint128 accountId)
  ```

  Mints an account token with an available id to `msg.sender`.

Emits a {AccountCreated} event.

#### notifyAccountTransfer

  ```solidity
  function notifyAccountTransfer(address to, uint128 accountId) external
  ```

  Called by AccountTokenModule to notify the system when the account token is transferred.

  Resets user permissions and assigns ownership of the account token to the new holder.

  | Name | Type | Description |
    |to|address|The new holder of the account NFT.|
    |accountId|uint128|The id of the account that was just transferred. Requirements: - `msg.sender` must be the account token.|

#### grantPermission

  ```solidity
  function grantPermission(uint128 accountId, bytes32 permission, address user) external
  ```

  Grants `permission` to `user` for account `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that granted the permission.|
    |permission|bytes32|The bytes32 identifier of the permission.|
    |user|address|The target address that received the permission. Requirements: - `msg.sender` must own the account token with ID `accountId` or have the "admin" permission. Emits a {PermissionGranted} event.|

#### revokePermission

  ```solidity
  function revokePermission(uint128 accountId, bytes32 permission, address user) external
  ```

  Revokes `permission` from `user` for account `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that revoked the permission.|
    |permission|bytes32|The bytes32 identifier of the permission.|
    |user|address|The target address that no longer has the permission. Requirements: - `msg.sender` must own the account token with ID `accountId` or have the "admin" permission. Emits a {PermissionRevoked} event.|

#### renouncePermission

  ```solidity
  function renouncePermission(uint128 accountId, bytes32 permission) external
  ```

  Revokes `permission` from `msg.sender` for account `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose permission was renounced.|
    |permission|bytes32|The bytes32 identifier of the permission. Emits a {PermissionRevoked} event.|

#### hasPermission

  ```solidity
  function hasPermission(uint128 accountId, bytes32 permission, address user) external view returns (bool hasPermission)
  ```

  Returns `true` if `user` has been granted `permission` for account `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose permission is being queried.|
    |permission|bytes32|The bytes32 identifier of the permission.|
    |user|address|The target address whose permission is being queried.|

  | Name | Type | Description |
    |hasPermission|bool|A boolean with the response of the query.|
#### isAuthorized

  ```solidity
  function isAuthorized(uint128 accountId, bytes32 permission, address target) external view returns (bool isAuthorized)
  ```

  Returns `true` if `target` is authorized to `permission` for account `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose permission is being queried.|
    |permission|bytes32|The bytes32 identifier of the permission.|
    |target|address|The target address whose permission is being queried.|

  | Name | Type | Description |
    |isAuthorized|bool|A boolean with the response of the query.|
#### getAccountTokenAddress

  ```solidity
  function getAccountTokenAddress() external view returns (address accountNftToken)
  ```

  Returns the address for the account token used by the module.

  | Name | Type | Description |
    |accountNftToken|address|The address of the account token.|
#### getAccountOwner

  ```solidity
  function getAccountOwner(uint128 accountId) external view returns (address owner)
  ```

  Returns the address that owns a given account, as recorded by the system.

  | Name | Type | Description |
    |accountId|uint128|The account id whose owner is being retrieved.|

  | Name | Type | Description |
    |owner|address|The owner of the given account id.|
#### getAccountLastInteraction

  ```solidity
  function getAccountLastInteraction(uint128 accountId) external view returns (uint256 timestamp)
  ```

  Returns the last unix timestamp that a permissioned action was taken with this account

  | Name | Type | Description |
    |accountId|uint128|The account id to check|

  | Name | Type | Description |
    |timestamp|uint256|The unix timestamp of the last time a permissioned action occured with the account|

### Events

#### AccountCreated

  ```solidity
  event AccountCreated(uint128 accountId, address owner)
  ```

  Emitted when an account token with id `accountId` is minted to `sender`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account.|
    |owner|address|The address that owns the created account.|

#### PermissionGranted

  ```solidity
  event PermissionGranted(uint128 accountId, bytes32 permission, address user, address sender)
  ```

  Emitted when `user` is granted `permission` by `sender` for account `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that granted the permission.|
    |permission|bytes32|The bytes32 identifier of the permission.|
    |user|address|The target address to whom the permission was granted.|
    |sender|address|The Address that granted the permission.|

#### PermissionRevoked

  ```solidity
  event PermissionRevoked(uint128 accountId, bytes32 permission, address user, address sender)
  ```

  Emitted when `user` has `permission` renounced or revoked by `sender` for account `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that has had the permission revoked.|
    |permission|bytes32|The bytes32 identifier of the permission.|
    |user|address|The target address for which the permission was revoked.|
    |sender|address|The address that revoked the permission.|

## Account Token Module

### Functions

#### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns whether the token has been initialized.

  | Name | Type | Description |
    |[0]|bool|A boolean with the result of the query.|
#### initialize

  ```solidity
  function initialize(string tokenName, string tokenSymbol, string uri) external
  ```

  Initializes the token with name, symbol, and uri.

#### mint

  ```solidity
  function mint(address to, uint256 tokenId) external
  ```

  Allows the owner to mint tokens.

  | Name | Type | Description |
    |to|address|The address to receive the newly minted tokens.|
    |tokenId|uint256|The ID of the newly minted token|

#### safeMint

  ```solidity
  function safeMint(address to, uint256 tokenId, bytes data) external
  ```

  Allows the owner to mint tokens. Verifies that the receiver can receive the token

  | Name | Type | Description |
    |to|address|The address to receive the newly minted token.|
    |tokenId|uint256|The ID of the newly minted token|
    |data|bytes|any data which should be sent to the receiver|

#### burn

  ```solidity
  function burn(uint256 tokenId) external
  ```

  Allows the owner to burn tokens.

  | Name | Type | Description |
    |tokenId|uint256|The token to burn|

#### setAllowance

  ```solidity
  function setAllowance(uint256 tokenId, address spender) external
  ```

  Allows an address that holds tokens to provide allowance to another.

  | Name | Type | Description |
    |tokenId|uint256|The token which should be allowed to spender|
    |spender|address|The address that is given allowance.|

#### setBaseTokenURI

  ```solidity
  function setBaseTokenURI(string uri) external
  ```

  Allows the owner to update the base token URI.

  | Name | Type | Description |
    |uri|string|The new base token uri|

#### totalSupply

  ```solidity
  function totalSupply() external view returns (uint256)
  ```

  Returns the total amount of tokens stored by the contract.

#### tokenOfOwnerByIndex

  ```solidity
  function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)
  ```

  Returns a token ID owned by `owner` at a given `index` of its token list.
Use along with {balanceOf} to enumerate all of ``owner``'s tokens.

Requirements:
- `owner` must be a valid address
- `index` must be less than the balance of the tokens for the owner

#### tokenByIndex

  ```solidity
  function tokenByIndex(uint256 index) external view returns (uint256)
  ```

  Returns a token ID at a given `index` of all the tokens stored by the contract.
Use along with {totalSupply} to enumerate all tokens.

Requirements:
- `index` must be less than the total supply of the tokens

#### balanceOf

  ```solidity
  function balanceOf(address holder) external view returns (uint256 balance)
  ```

  Returns the number of tokens in ``owner``'s account.

Requirements:

- `holder` must be a valid address

#### ownerOf

  ```solidity
  function ownerOf(uint256 tokenId) external view returns (address owner)
  ```

  Returns the owner of the `tokenId` token.

Requirements:

- `tokenId` must exist.

#### safeTransferFrom

  ```solidity
  function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external
  ```

  Safely transfers `tokenId` token from `from` to `to`.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event.

#### safeTransferFrom

  ```solidity
  function safeTransferFrom(address from, address to, uint256 tokenId) external
  ```

  Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
are aware of the ERC721 protocol to prevent tokens from being forever locked.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must have been allowed to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event.

#### transferFrom

  ```solidity
  function transferFrom(address from, address to, uint256 tokenId) external
  ```

  Transfers `tokenId` token from `from` to `to`.

WARNING: Usage of this method is discouraged, use {safeTransferFrom} whenever possible.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.

Emits a {Transfer} event.

#### approve

  ```solidity
  function approve(address to, uint256 tokenId) external
  ```

  Gives permission to `to` to transfer `tokenId` token to another account.
The approval is cleared when the token is transferred.

Only a single account can be approved at a time, so approving the zero address clears previous approvals.

Requirements:

- The caller must own the token or be an approved operator.
- `tokenId` must exist.

Emits an {Approval} event.

#### setApprovalForAll

  ```solidity
  function setApprovalForAll(address operator, bool approved) external
  ```

  Approve or remove `operator` as an operator for the caller.
Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.

Requirements:

- The `operator` cannot be the caller.

Emits an {ApprovalForAll} event.

#### getApproved

  ```solidity
  function getApproved(uint256 tokenId) external view returns (address operator)
  ```

  Returns the account approved for `tokenId` token.

Requirements:

- `tokenId` must exist.

#### isApprovedForAll

  ```solidity
  function isApprovedForAll(address owner, address operator) external view returns (bool)
  ```

  Returns if the `operator` is allowed to manage all of the assets of `owner`.

See {setApprovalForAll}

### Events

#### Transfer

  ```solidity
  event Transfer(address from, address to, uint256 tokenId)
  ```

  Emitted when `tokenId` token is transferred from `from` to `to`.

#### Approval

  ```solidity
  event Approval(address owner, address approved, uint256 tokenId)
  ```

  Emitted when `owner` enables `approved` to manage the `tokenId` token.

#### ApprovalForAll

  ```solidity
  event ApprovalForAll(address owner, address operator, bool approved)
  ```

  Emitted when `owner` enables or disables (`approved`) `operator` to manage all of its assets.

## Associate Debt Module

### Functions

#### associateDebt

  ```solidity
  function associateDebt(uint128 marketId, uint128 poolId, address collateralType, uint128 accountId, uint256 amount) external returns (int256 debtAmount)
  ```

  Allows a market to associate debt with a specific position.
The specified debt will be removed from all vault participants pro-rata. After removing the debt, the amount will
be allocated directly to the specified account.
**NOTE**: if the specified account is an existing staker on the vault, their position will be included in the pro-rata
reduction. Ex: if there are 10 users staking 10 USD of debt on a pool, and associate debt is called with 10 USD on one of those users,
their debt after the operation is complete will be 19 USD. This might seem unusual, but its actually ideal behavior when
your market has incurred some new debt, and it wants to allocate this amount directly to a specific user. In this case, the user's
debt balance would increase pro rata, but then get decreased pro-rata, and then increased to the full amount on their account. All
other accounts would be left with no change to their debt, however.

  | Name | Type | Description |
    |marketId|uint128|The id of the market to which debt was associated.|
    |poolId|uint128|The id of the pool associated to the target market.|
    |collateralType|address|The address of the collateral type that acts as collateral in the corresponding pool.|
    |accountId|uint128|The id of the account whose debt is being associated.|
    |amount|uint256|The amount of debt being associated with the specified account, denominated with 18 decimals of precision.|

  | Name | Type | Description |
    |debtAmount|int256|The updated debt of the position, denominated with 18 decimals of precision.|

### Events

#### DebtAssociated

  ```solidity
  event DebtAssociated(uint128 marketId, uint128 poolId, address collateralType, uint128 accountId, uint256 amount, int256 updatedDebt)
  ```

  Emitted when `associateDebt` is called.

  | Name | Type | Description |
    |marketId|uint128|The id of the market to which debt was associated.|
    |poolId|uint128|The id of the pool associated to the target market.|
    |collateralType|address|The address of the collateral type that acts as collateral in the corresponding pool.|
    |accountId|uint128|The id of the account whose debt is being associated.|
    |amount|uint256|The amount of debt being associated with the specified account, denominated with 18 decimals of precision.|
    |updatedDebt|int256|The total updated debt of the account, denominated with 18 decimals of precision|

## Collateral Configuration Module

### Functions

#### configureCollateral

  ```solidity
  function configureCollateral(struct CollateralConfiguration.Data config) external
  ```

  Creates or updates the configuration for the given `collateralType`.

  | Name | Type | Description |
    |config|struct CollateralConfiguration.Data|The CollateralConfiguration object describing the new configuration. Requirements: - `msg.sender` must be the owner of the system. Emits a {CollateralConfigured} event.|

#### getCollateralConfigurations

  ```solidity
  function getCollateralConfigurations(bool hideDisabled) external view returns (struct CollateralConfiguration.Data[] collaterals)
  ```

  Returns a list of detailed information pertaining to all collateral types registered in the system.

  Optionally returns only those that are currently enabled.

  | Name | Type | Description |
    |hideDisabled|bool|Wether to hide disabled collaterals or just return the full list of collaterals in the system.|

  | Name | Type | Description |
    |collaterals|struct CollateralConfiguration.Data[]|The list of collateral configuration objects set in the system.|
#### getCollateralConfiguration

  ```solidity
  function getCollateralConfiguration(address collateralType) external view returns (struct CollateralConfiguration.Data collateral)
  ```

  Returns detailed information pertaining the specified collateral type.

  | Name | Type | Description |
    |collateralType|address|The address for the collateral whose configuration is being queried.|

  | Name | Type | Description |
    |collateral|struct CollateralConfiguration.Data|The configuration object describing the given collateral.|
#### getCollateralPrice

  ```solidity
  function getCollateralPrice(address collateralType) external view returns (uint256 priceD18)
  ```

  Returns the current value of a specified collateral type.

  | Name | Type | Description |
    |collateralType|address|The address for the collateral whose price is being queried.|

  | Name | Type | Description |
    |priceD18|uint256|The price of the given collateral, denominated with 18 decimals of precision.|

### Events

#### CollateralConfigured

  ```solidity
  event CollateralConfigured(address collateralType, struct CollateralConfiguration.Data config)
  ```

  Emitted when a collateral type’s configuration is created or updated.

  | Name | Type | Description |
    |collateralType|address|The address of the collateral type that was just configured.|
    |config|struct CollateralConfiguration.Data|The object with the newly configured details.|

## Collateral Module

### Functions

#### deposit

  ```solidity
  function deposit(uint128 accountId, address collateralType, uint256 tokenAmount) external
  ```

  Deposits `tokenAmount` of collateral of type `collateralType` into account `accountId`.

  Anyone can deposit into anyone's active account without restriction.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that is making the deposit.|
    |collateralType|address|The address of the token to be deposited.|
    |tokenAmount|uint256|The amount being deposited, denominated in the token's native decimal representation. Emits a {Deposited} event.|

#### withdraw

  ```solidity
  function withdraw(uint128 accountId, address collateralType, uint256 tokenAmount) external
  ```

  Withdraws `tokenAmount` of collateral of type `collateralType` from account `accountId`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that is making the withdrawal.|
    |collateralType|address|The address of the token to be withdrawn.|
    |tokenAmount|uint256|The amount being withdrawn, denominated in the token's native decimal representation. Requirements: - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `WITHDRAW` permission. Emits a {Withdrawn} event.|

#### getAccountCollateral

  ```solidity
  function getAccountCollateral(uint128 accountId, address collateralType) external view returns (uint256 totalDeposited, uint256 totalAssigned, uint256 totalLocked)
  ```

  Returns the total values pertaining to account `accountId` for `collateralType`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose collateral is being queried.|
    |collateralType|address|The address of the collateral type whose amount is being queried.|

  | Name | Type | Description |
    |totalDeposited|uint256|The total collateral deposited in the account, denominated with 18 decimals of precision.|
    |totalAssigned|uint256|The amount of collateral in the account that is delegated to pools, denominated with 18 decimals of precision.|
    |totalLocked|uint256|The amount of collateral in the account that cannot currently be undelegated from a pool, denominated with 18 decimals of precision.|
#### getAccountAvailableCollateral

  ```solidity
  function getAccountAvailableCollateral(uint128 accountId, address collateralType) external view returns (uint256 amountD18)
  ```

  Returns the amount of collateral of type `collateralType` deposited with account `accountId` that can be withdrawn or delegated to pools.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose collateral is being queried.|
    |collateralType|address|The address of the collateral type whose amount is being queried.|

  | Name | Type | Description |
    |amountD18|uint256|The amount of collateral that is available for withdrawal or delegation, denominated with 18 decimals of precision.|
#### cleanExpiredLocks

  ```solidity
  function cleanExpiredLocks(uint128 accountId, address collateralType, uint256 offset, uint256 count) external returns (uint256 cleared)
  ```

  Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited).

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose locks are being cleared.|
    |collateralType|address|The address of the collateral type to clean locks for.|
    |offset|uint256|The index of the first lock to clear.|
    |count|uint256|The number of slots to check for cleaning locks. Set to 0 to clean all locks at/after offset|

  | Name | Type | Description |
    |cleared|uint256|the number of locks that were actually expired (and therefore cleared)|
#### getLocks

  ```solidity
  function getLocks(uint128 accountId, address collateralType, uint256 offset, uint256 count) external view returns (struct CollateralLock.Data[] locks)
  ```

  Get a list of locks existing in account. Lists all locks in storage, even if they are expired

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose locks we want to read|
    |collateralType|address|The address of the collateral type for locks we want to read|
    |offset|uint256|The index of the first lock to read|
    |count|uint256|The number of slots to check for cleaning locks. Set to 0 to read all locks after offset|

#### createLock

  ```solidity
  function createLock(uint128 accountId, address collateralType, uint256 amount, uint64 expireTimestamp) external
  ```

  Create a new lock on the given account. you must have `admin` permission on the specified account to create a lock.

  Collateral can be withdrawn from the system if it is not assigned or delegated to a pool. Collateral locks are an additional restriction that applies on top of that. I.e. if collateral is not assigned to a pool, but has a lock, it cannot be withdrawn.
Collateral locks are initially intended for the Synthetix v2 to v3 migration, but may be used in the future by the Spartan Council, for example, to create and hand off accounts whose withdrawals from the system are locked for a given amount of time.

  | Name | Type | Description |
    |accountId|uint128|The id of the account for which a lock is to be created.|
    |collateralType|address|The address of the collateral type for which the lock will be created.|
    |amount|uint256|The amount of collateral tokens to wrap in the lock being created, denominated with 18 decimals of precision.|
    |expireTimestamp|uint64|The date in which the lock will become clearable.|

### Events

#### Deposited

  ```solidity
  event Deposited(uint128 accountId, address collateralType, uint256 tokenAmount, address sender)
  ```

  Emitted when `tokenAmount` of collateral of type `collateralType` is deposited to account `accountId` by `sender`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that deposited collateral.|
    |collateralType|address|The address of the collateral that was deposited.|
    |tokenAmount|uint256|The amount of collateral that was deposited, denominated in the token's native decimal representation.|
    |sender|address|The address of the account that triggered the deposit.|

#### CollateralLockCreated

  ```solidity
  event CollateralLockCreated(uint128 accountId, address collateralType, uint256 tokenAmount, uint64 expireTimestamp)
  ```

  Emitted when a lock is created on someone's account

  | Name | Type | Description |
    |accountId|uint128|The id of the account that received a lock|
    |collateralType|address|The address of the collateral type that was locked|
    |tokenAmount|uint256|The amount of collateral that was locked, demoninated in system units (1e18)|
    |expireTimestamp|uint64|unix timestamp at which the lock is due to expire|

#### CollateralLockExpired

  ```solidity
  event CollateralLockExpired(uint128 accountId, address collateralType, uint256 tokenAmount, uint64 expireTimestamp)
  ```

  Emitted when a lock is cleared from an account due to expiration

  | Name | Type | Description |
    |accountId|uint128|The id of the account that has the expired lock|
    |collateralType|address|The address of the collateral type that was unlocked|
    |tokenAmount|uint256|The amount of collateral that was unlocked, demoninated in system units (1e18)|
    |expireTimestamp|uint64|unix timestamp at which the unlock is due to expire|

#### Withdrawn

  ```solidity
  event Withdrawn(uint128 accountId, address collateralType, uint256 tokenAmount, address sender)
  ```

  Emitted when `tokenAmount` of collateral of type `collateralType` is withdrawn from account `accountId` by `sender`.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that withdrew collateral.|
    |collateralType|address|The address of the collateral that was withdrawn.|
    |tokenAmount|uint256|The amount of collateral that was withdrawn, denominated in the token's native decimal representation.|
    |sender|address|The address of the account that triggered the withdrawal.|

## IssueUSD Module

### Functions

#### mintUsd

  ```solidity
  function mintUsd(uint128 accountId, uint128 poolId, address collateralType, uint256 amount) external
  ```

  Mints {amount} of snxUSD with the specified liquidity position.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that is minting snxUSD.|
    |poolId|uint128|The id of the pool whose collateral will be used to back up the mint.|
    |collateralType|address|The address of the collateral that will be used to back up the mint.|
    |amount|uint256|The amount of snxUSD to be minted, denominated with 18 decimals of precision. Requirements: - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `MINT` permission. - After minting, the collateralization ratio of the liquidity position must not be below the target collateralization ratio for the corresponding collateral type. Emits a {UsdMinted} event.|

#### burnUsd

  ```solidity
  function burnUsd(uint128 accountId, uint128 poolId, address collateralType, uint256 amount) external
  ```

  Burns {amount} of snxUSD with the specified liquidity position.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that is burning snxUSD.|
    |poolId|uint128|The id of the pool whose collateral was used to back up the snxUSD.|
    |collateralType|address|The address of the collateral that was used to back up the snxUSD.|
    |amount|uint256|The amount of snxUSD to be burnt, denominated with 18 decimals of precision. Emits a {UsdMinted} event.|

### Events

#### UsdMinted

  ```solidity
  event UsdMinted(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when {sender} mints {amount} of snxUSD with the specified liquidity position.

  | Name | Type | Description |
    |accountId|uint128|The id of the account for which snxUSD was emitted.|
    |poolId|uint128|The id of the pool whose collateral was used to emit the snxUSD.|
    |collateralType|address|The address of the collateral that is backing up the emitted snxUSD.|
    |amount|uint256|The amount of snxUSD emitted, denominated with 18 decimals of precision.|
    |sender|address|The address that triggered the operation.|

#### UsdBurned

  ```solidity
  event UsdBurned(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when {sender} burns {amount} of snxUSD with the specified liquidity position.

  | Name | Type | Description |
    |accountId|uint128|The id of the account for which snxUSD was burned.|
    |poolId|uint128|The id of the pool whose collateral was used to emit the snxUSD.|
    |collateralType|address|The address of the collateral that was backing up the emitted snxUSD.|
    |amount|uint256|The amount of snxUSD burned, denominated with 18 decimals of precision.|
    |sender|address|The address that triggered the operation.|

#### IssuanceFeePaid

  ```solidity
  event IssuanceFeePaid(uint128 accountId, uint128 poolId, address collateralType, uint256 feeAmount)
  ```

## Liquidation Module

### Functions

#### liquidate

  ```solidity
  function liquidate(uint128 accountId, uint128 poolId, address collateralType, uint128 liquidateAsAccountId) external returns (struct ILiquidationModule.LiquidationData liquidationData)
  ```

  Liquidates a position by distributing its debt and collateral among other positions in its vault.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose position is to be liquidated.|
    |poolId|uint128|The id of the pool which holds the position that is to be liquidated.|
    |collateralType|address|The address of the collateral being used in the position that is to be liquidated.|
    |liquidateAsAccountId|uint128|Account id that will receive the rewards from the liquidation.|

  | Name | Type | Description |
    |liquidationData|struct ILiquidationModule.LiquidationData|Information about the position that was liquidated.|
#### liquidateVault

  ```solidity
  function liquidateVault(uint128 poolId, address collateralType, uint128 liquidateAsAccountId, uint256 maxUsd) external returns (struct ILiquidationModule.LiquidationData liquidationData)
  ```

  Liquidates an entire vault.

  Can only be done if the vault itself is under collateralized.
LiquidateAsAccountId determines which account to deposit the seized collateral into (this is necessary particularly if the collateral in the vault is vesting).
Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose vault is being liquidated.|
    |collateralType|address|The address of the collateral whose vault is being liquidated.|
    |liquidateAsAccountId|uint128||
    |maxUsd|uint256|The maximum amount of USD that the liquidator is willing to provide for the liquidation, denominated with 18 decimals of precision.|

  | Name | Type | Description |
    |liquidationData|struct ILiquidationModule.LiquidationData|Information about the vault that was liquidated.|
#### isPositionLiquidatable

  ```solidity
  function isPositionLiquidatable(uint128 accountId, uint128 poolId, address collateralType) external returns (bool canLiquidate)
  ```

  Determines whether a specified position is liquidatable.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose position is being queried for liquidation.|
    |poolId|uint128|The id of the pool whose position is being queried for liquidation.|
    |collateralType|address|The address of the collateral backing up the position being queried for liquidation.|

  | Name | Type | Description |
    |canLiquidate|bool|A boolean with the response to the query.|
#### isVaultLiquidatable

  ```solidity
  function isVaultLiquidatable(uint128 poolId, address collateralType) external returns (bool canVaultLiquidate)
  ```

  Determines whether a specified vault is liquidatable.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool that owns the vault that is being queried for liquidation.|
    |collateralType|address|The address of the collateral being held at the vault that is being queried for liquidation.|

  | Name | Type | Description |
    |canVaultLiquidate|bool|A boolean with the response to the query.|

### Events

#### Liquidation

  ```solidity
  event Liquidation(uint128 accountId, uint128 poolId, address collateralType, struct ILiquidationModule.LiquidationData liquidationData, uint128 liquidateAsAccountId, address sender)
  ```

  Emitted when an account is liquidated.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that was liquidated.|
    |poolId|uint128|The pool id of the position that was liquidated.|
    |collateralType|address|The collateral type used in the position that was liquidated.|
    |liquidationData|struct ILiquidationModule.LiquidationData|The amount of collateral liquidated, debt liquidated, and collateral awarded to the liquidator.|
    |liquidateAsAccountId|uint128|Account id that will receive the rewards from the liquidation.|
    |sender|address|The address of the account that is triggering the liquidation.|

#### VaultLiquidation

  ```solidity
  event VaultLiquidation(uint128 poolId, address collateralType, struct ILiquidationModule.LiquidationData liquidationData, uint128 liquidateAsAccountId, address sender)
  ```

  Emitted when a vault is liquidated.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose vault was liquidated.|
    |collateralType|address|The collateral address of the vault that was liquidated.|
    |liquidationData|struct ILiquidationModule.LiquidationData|The amount of collateral liquidated, debt liquidated, and collateral awarded to the liquidator.|
    |liquidateAsAccountId|uint128|Account id that will receive the rewards from the liquidation.|
    |sender|address|The address of the account that is triggering the liquidation.|

## Market Collateral Module

### Functions

#### depositMarketCollateral

  ```solidity
  function depositMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

  Allows a market to deposit collateral.

  | Name | Type | Description |
    |marketId|uint128|The id of the market in which the collateral was directly deposited.|
    |collateralType|address|The address of the collateral that was deposited in the market.|
    |amount|uint256|The amount of collateral that was deposited, denominated in the token's native decimal representation.|

#### withdrawMarketCollateral

  ```solidity
  function withdrawMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

  Allows a market to withdraw collateral that it has previously deposited.

  | Name | Type | Description |
    |marketId|uint128|The id of the market from which the collateral was withdrawn.|
    |collateralType|address|The address of the collateral that was withdrawn from the market.|
    |amount|uint256|The amount of collateral that was withdrawn, denominated in the token's native decimal representation.|

#### configureMaximumMarketCollateral

  ```solidity
  function configureMaximumMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

  Allow the system owner to configure the maximum amount of a given collateral type that a specified market is allowed to deposit.

  | Name | Type | Description |
    |marketId|uint128|The id of the market for which the maximum is to be configured.|
    |collateralType|address|The address of the collateral for which the maximum is to be applied.|
    |amount|uint256|The amount that is to be set as the new maximum, denominated with 18 decimals of precision.|

#### getMaximumMarketCollateral

  ```solidity
  function getMaximumMarketCollateral(uint128 marketId, address collateralType) external returns (uint256 amountD18)
  ```

  Return the total maximum amount of a given collateral type that a specified market is allowed to deposit.

  | Name | Type | Description |
    |marketId|uint128|The id of the market for which the maximum is being queried.|
    |collateralType|address|The address of the collateral for which the maximum is being queried.|

  | Name | Type | Description |
    |amountD18|uint256|The maximum amount of collateral set for the market, denominated with 18 decimals of precision.|
#### getMarketCollateralAmount

  ```solidity
  function getMarketCollateralAmount(uint128 marketId, address collateralType) external view returns (uint256 amountD18)
  ```

  Return the total amount of a given collateral type that a specified market has deposited.

  | Name | Type | Description |
    |marketId|uint128|The id of the market for which the directly deposited collateral amount is being queried.|
    |collateralType|address|The address of the collateral for which the amount is being queried.|

  | Name | Type | Description |
    |amountD18|uint256|The total amount of collateral of this type delegated to the market, denominated with 18 decimals of precision.|
#### getMarketCollateralValue

  ```solidity
  function getMarketCollateralValue(uint128 marketId) external returns (uint256 valueD18)
  ```

  Return the total value of collateral that a specified market has deposited.

  | Name | Type | Description |
    |marketId|uint128|The id of the market for which the directly deposited collateral amount is being queried.|

  | Name | Type | Description |
    |valueD18|uint256|The total value of collateral deposited by the market, denominated with 18 decimals of precision.|

### Events

#### MarketCollateralDeposited

  ```solidity
  event MarketCollateralDeposited(uint128 marketId, address collateralType, uint256 tokenAmount, address sender)
  ```

  Emitted when `amount` of collateral of type `collateralType` is deposited to market `marketId` by `sender`.

  | Name | Type | Description |
    |marketId|uint128|The id of the market in which collateral was deposited.|
    |collateralType|address|The address of the collateral that was directly deposited in the market.|
    |tokenAmount|uint256|The amount of tokens that were deposited, denominated in the token's native decimal representation.|
    |sender|address|The address that triggered the deposit.|

#### MarketCollateralWithdrawn

  ```solidity
  event MarketCollateralWithdrawn(uint128 marketId, address collateralType, uint256 tokenAmount, address sender)
  ```

  Emitted when `amount` of collateral of type `collateralType` is withdrawn from market `marketId` by `sender`.

  | Name | Type | Description |
    |marketId|uint128|The id of the market from which collateral was withdrawn.|
    |collateralType|address|The address of the collateral that was withdrawn from the market.|
    |tokenAmount|uint256|The amount of tokens that were withdrawn, denominated in the token's native decimal representation.|
    |sender|address|The address that triggered the withdrawal.|

#### MaximumMarketCollateralConfigured

  ```solidity
  event MaximumMarketCollateralConfigured(uint128 marketId, address collateralType, uint256 systemAmount, address owner)
  ```

  Emitted when the system owner specifies the maximum depositable collateral of a given type in a given market.

  | Name | Type | Description |
    |marketId|uint128|The id of the market for which the maximum was configured.|
    |collateralType|address|The address of the collateral for which the maximum was configured.|
    |systemAmount|uint256|The amount to which the maximum was set, denominated with 18 decimals of precision.|
    |owner|address|The owner of the system, which triggered the configuration change.|

## Market Manager Module

### Functions

#### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint128 newMarketId)
  ```

  Connects an external market to the system.

  Creates a Market object to track the external market, and returns the newly created market id.

  | Name | Type | Description |
    |market|address|The address of the external market that is to be registered in the system.|

  | Name | Type | Description |
    |newMarketId|uint128|The id with which the market will be registered in the system.|
#### depositMarketUsd

  ```solidity
  function depositMarketUsd(uint128 marketId, address target, uint256 amount) external returns (uint256 feeAmount)
  ```

  Allows an external market connected to the system to deposit USD in the system.

  The system burns the incoming USD, increases the market's credit capacity, and reduces its issuance.
See `IMarket`.

  | Name | Type | Description |
    |marketId|uint128|The id of the market in which snxUSD will be deposited.|
    |target|address|The address of the account on who's behalf the deposit will be made.|
    |amount|uint256|The amount of snxUSD to be deposited, denominated with 18 decimals of precision.|

  | Name | Type | Description |
    |feeAmount|uint256|the amount of fees paid (billed as additional debt towards liquidity providers)|
#### withdrawMarketUsd

  ```solidity
  function withdrawMarketUsd(uint128 marketId, address target, uint256 amount) external returns (uint256 feeAmount)
  ```

  Allows an external market connected to the system to withdraw snxUSD from the system.

  The system mints the requested snxUSD (provided that the market has sufficient credit), reduces the market's credit capacity, and increases its net issuance.
See `IMarket`.

  | Name | Type | Description |
    |marketId|uint128|The id of the market from which snxUSD will be withdrawn.|
    |target|address|The address of the account that will receive the withdrawn snxUSD.|
    |amount|uint256|The amount of snxUSD to be withdraw, denominated with 18 decimals of precision.|

  | Name | Type | Description |
    |feeAmount|uint256|the amount of fees paid (billed as additional debt towards liquidity providers)|
#### getMarketFees

  ```solidity
  function getMarketFees(uint128 marketId, uint256 amount) external view returns (uint256 depositFeeAmount, uint256 withdrawFeeAmount)
  ```

  Get the amount of fees paid in USD for a call to `depositMarketUsd` and `withdrawMarketUsd` for the given market and amount

  | Name | Type | Description |
    |marketId|uint128|The market to check fees for|
    |amount|uint256|The amount deposited or withdrawn in USD|

  | Name | Type | Description |
    |depositFeeAmount|uint256|the amount of USD paid for a call to `depositMarketUsd`|
    |withdrawFeeAmount|uint256|the amount of USD paid for a call to `withdrawMarketUsd`|
#### getWithdrawableMarketUsd

  ```solidity
  function getWithdrawableMarketUsd(uint128 marketId) external view returns (uint256 withdrawableD18)
  ```

  Returns the total withdrawable snxUSD amount for the specified market.

  | Name | Type | Description |
    |marketId|uint128|The id of the market whose withdrawable USD amount is being queried.|

  | Name | Type | Description |
    |withdrawableD18|uint256|The total amount of snxUSD that the market could withdraw at the time of the query, denominated with 18 decimals of precision.|
#### getMarketNetIssuance

  ```solidity
  function getMarketNetIssuance(uint128 marketId) external view returns (int128 issuanceD18)
  ```

  Returns the net issuance of the specified market (snxUSD withdrawn - snxUSD deposited).

  | Name | Type | Description |
    |marketId|uint128|The id of the market whose net issuance is being queried.|

  | Name | Type | Description |
    |issuanceD18|int128|The net issuance of the market, denominated with 18 decimals of precision.|
#### getMarketReportedDebt

  ```solidity
  function getMarketReportedDebt(uint128 marketId) external view returns (uint256 reportedDebtD18)
  ```

  Returns the reported debt of the specified market.

  | Name | Type | Description |
    |marketId|uint128|The id of the market whose reported debt is being queried.|

  | Name | Type | Description |
    |reportedDebtD18|uint256|The market's reported debt, denominated with 18 decimals of precision.|
#### getMarketTotalDebt

  ```solidity
  function getMarketTotalDebt(uint128 marketId) external view returns (int256 totalDebtD18)
  ```

  Returns the total debt of the specified market.

  | Name | Type | Description |
    |marketId|uint128|The id of the market whose debt is being queried.|

  | Name | Type | Description |
    |totalDebtD18|int256|The total debt of the market, denominated with 18 decimals of precision.|
#### getMarketCollateral

  ```solidity
  function getMarketCollateral(uint128 marketId) external view returns (uint256 valueD18)
  ```

  Returns the total snxUSD value of the collateral for the specified market.

  | Name | Type | Description |
    |marketId|uint128|The id of the market whose collateral is being queried.|

  | Name | Type | Description |
    |valueD18|uint256|The market's total snxUSD value of collateral, denominated with 18 decimals of precision.|
#### getMarketDebtPerShare

  ```solidity
  function getMarketDebtPerShare(uint128 marketId) external returns (int256 debtPerShareD18)
  ```

  Returns the value per share of the debt of the specified market.

  This is not a view function, and actually updates the entire debt distribution chain.

  | Name | Type | Description |
    |marketId|uint128|The id of the market whose debt per share is being queried.|

  | Name | Type | Description |
    |debtPerShareD18|int256|The market's debt per share value, denominated with 18 decimals of precision.|
#### isMarketCapacityLocked

  ```solidity
  function isMarketCapacityLocked(uint128 marketId) external view returns (bool isLocked)
  ```

  Returns whether the capacity of the specified market is locked.

  | Name | Type | Description |
    |marketId|uint128|The id of the market whose capacity is being queried.|

  | Name | Type | Description |
    |isLocked|bool|A boolean that is true if the market's capacity is locked at the time of the query.|
#### getUsdToken

  ```solidity
  function getUsdToken() external view returns (contract IERC20)
  ```

  Returns the USD token associated with this synthetix core system

#### getOracleManager

  ```solidity
  function getOracleManager() external view returns (contract IOracleManager)
  ```

  Retrieve the systems' configured oracle manager address

#### distributeDebtToPools

  ```solidity
  function distributeDebtToPools(uint128 marketId, uint256 maxIter) external returns (bool finishedDistributing)
  ```

  Update a market's current debt registration with the system.
This function is provided as an escape hatch for pool griefing, preventing
overwhelming the system with a series of very small pools and creating high gas
costs to update an account.

  | Name | Type | Description |
    |marketId|uint128|the id of the market that needs pools bumped|
    |maxIter|uint256||

  | Name | Type | Description |
    |finishedDistributing|bool|whether or not all bumpable pools have been bumped and target price has been reached|
#### setMarketMinDelegateTime

  ```solidity
  function setMarketMinDelegateTime(uint128 marketId, uint32 minDelegateTime) external
  ```

  allows for a market to set its minimum delegation time. This is useful for preventing stakers from frontrunning rewards or losses
by limiting the frequency of `delegateCollateral` (or `setPoolConfiguration`) calls. By default, there is no minimum delegation time.

  | Name | Type | Description |
    |marketId|uint128|the id of the market that wants to set delegation time.|
    |minDelegateTime|uint32|the minimum number of seconds between delegation calls. Note: this value must be less than the globally defined maximum minDelegateTime|

#### getMarketMinDelegateTime

  ```solidity
  function getMarketMinDelegateTime(uint128 marketId) external view returns (uint32)
  ```

  Retrieve the minimum delegation time of a market

  | Name | Type | Description |
    |marketId|uint128|the id of the market|

#### setMinLiquidityRatio

  ```solidity
  function setMinLiquidityRatio(uint128 marketId, uint256 minLiquidityRatio) external
  ```

  Allows the system owner (not the pool owner) to set a market-specific minimum liquidity ratio.

  | Name | Type | Description |
    |marketId|uint128|the id of the market|
    |minLiquidityRatio|uint256|The new market-specific minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)|

#### getMinLiquidityRatio

  ```solidity
  function getMinLiquidityRatio(uint128 marketId) external view returns (uint256 minRatioD18)
  ```

  Retrieves the market-specific minimum liquidity ratio.

  | Name | Type | Description |
    |marketId|uint128|the id of the market|

  | Name | Type | Description |
    |minRatioD18|uint256|The current market-specific minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)|

### Events

#### MarketRegistered

  ```solidity
  event MarketRegistered(address market, uint128 marketId, address sender)
  ```

  Emitted when a new market is registered in the system.

  | Name | Type | Description |
    |market|address|The address of the external market that was registered in the system.|
    |marketId|uint128|The id with which the market was registered in the system.|
    |sender|address|The account that trigger the registration of the market.|

#### MarketUsdDeposited

  ```solidity
  event MarketUsdDeposited(uint128 marketId, address target, uint256 amount, address market)
  ```

  Emitted when a market deposits snxUSD in the system.

  | Name | Type | Description |
    |marketId|uint128|The id of the market that deposited snxUSD in the system.|
    |target|address|The address of the account that provided the snxUSD in the deposit.|
    |amount|uint256|The amount of snxUSD deposited in the system, denominated with 18 decimals of precision.|
    |market|address|The address of the external market that is depositing.|

#### MarketUsdWithdrawn

  ```solidity
  event MarketUsdWithdrawn(uint128 marketId, address target, uint256 amount, address market)
  ```

  Emitted when a market withdraws snxUSD from the system.

  | Name | Type | Description |
    |marketId|uint128|The id of the market that withdrew snxUSD from the system.|
    |target|address|The address of the account that received the snxUSD in the withdrawal.|
    |amount|uint256|The amount of snxUSD withdrawn from the system, denominated with 18 decimals of precision.|
    |market|address|The address of the external market that is withdrawing.|

#### MarketSystemFeePaid

  ```solidity
  event MarketSystemFeePaid(uint128 marketId, uint256 feeAmount)
  ```

#### SetMinDelegateTime

  ```solidity
  event SetMinDelegateTime(uint128 marketId, uint32 minDelegateTime)
  ```

  Emitted when a market sets an updated minimum delegation time

  | Name | Type | Description |
    |marketId|uint128|The id of the market that the setting is applied to|
    |minDelegateTime|uint32|The minimum amount of time between delegation changes|

#### SetMarketMinLiquidityRatio

  ```solidity
  event SetMarketMinLiquidityRatio(uint128 marketId, uint256 minLiquidityRatio)
  ```

  Emitted when a market-specific minimum liquidity ratio is set

  | Name | Type | Description |
    |marketId|uint128|The id of the market that the setting is applied to|
    |minLiquidityRatio|uint256|The new market-specific minimum liquidity ratio|

## Multicall Module

### Functions

#### multicall

  ```solidity
  function multicall(bytes[] data) external payable returns (bytes[] results)
  ```

  Executes multiple transaction payloads in a single transaction.

  Each transaction is executed using `delegatecall`, and targets the system address.

  | Name | Type | Description |
    |data|bytes[]|Array of calldata objects, one for each function that is to be called in the system.|

  | Name | Type | Description |
    |results|bytes[]|Array of each `delegatecall`'s response corresponding to the incoming calldata array.|

### Events

## Pool Configuration Module

### Functions

#### setPreferredPool

  ```solidity
  function setPreferredPool(uint128 poolId) external
  ```

  Sets the unique system preferred pool.

  Note: The preferred pool does not receive any special treatment. It is only signaled as preferred here.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool that is to be set as preferred.|

#### addApprovedPool

  ```solidity
  function addApprovedPool(uint128 poolId) external
  ```

  Marks a pool as approved by the system owner.

  Approved pools do not receive any special treatment. They are only signaled as approved here.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool that is to be approved.|

#### removeApprovedPool

  ```solidity
  function removeApprovedPool(uint128 poolId) external
  ```

  Un-marks a pool as preferred by the system owner.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool that is to be no longer approved.|

#### getPreferredPool

  ```solidity
  function getPreferredPool() external view returns (uint128 poolId)
  ```

  Retrieves the unique system preferred pool.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool that is currently set as preferred in the system.|
#### getApprovedPools

  ```solidity
  function getApprovedPools() external view returns (uint256[] poolIds)
  ```

  Retrieves the pool that are approved by the system owner.

  | Name | Type | Description |
    |poolIds|uint256[]|An array with all of the pool ids that are approved in the system.|

### Events

#### PreferredPoolSet

  ```solidity
  event PreferredPoolSet(uint256 poolId)
  ```

  Emitted when the system owner sets the preferred pool.

  | Name | Type | Description |
    |poolId|uint256|The id of the pool that was set as preferred.|

#### PoolApprovedAdded

  ```solidity
  event PoolApprovedAdded(uint256 poolId)
  ```

  Emitted when the system owner adds an approved pool.

  | Name | Type | Description |
    |poolId|uint256|The id of the pool that was approved.|

#### PoolApprovedRemoved

  ```solidity
  event PoolApprovedRemoved(uint256 poolId)
  ```

  Emitted when the system owner removes an approved pool.

  | Name | Type | Description |
    |poolId|uint256|The id of the pool that is no longer approved.|

## Pool Module

### Functions

#### createPool

  ```solidity
  function createPool(uint128 requestedPoolId, address owner) external
  ```

  Creates a pool with the requested pool id.

  | Name | Type | Description |
    |requestedPoolId|uint128|The requested id for the new pool. Reverts if the id is not available.|
    |owner|address|The address that will own the newly created pool.|

#### setPoolConfiguration

  ```solidity
  function setPoolConfiguration(uint128 poolId, struct MarketConfiguration.Data[] marketDistribution) external
  ```

  Allows the pool owner to configure the pool.

  The pool's configuration is composed of an array of MarketConfiguration objects, which describe which markets the pool provides liquidity to, in what proportion, and to what extent.
Incoming market ids need to be provided in ascending order.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose configuration is being set.|
    |marketDistribution|struct MarketConfiguration.Data[]|The array of market configuration objects that define the list of markets that are connected to the system.|

#### getPoolConfiguration

  ```solidity
  function getPoolConfiguration(uint128 poolId) external view returns (struct MarketConfiguration.Data[] markets)
  ```

  Retrieves the MarketConfiguration of the specified pool.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose configuration is being queried.|

  | Name | Type | Description |
    |markets|struct MarketConfiguration.Data[]|The array of MarketConfiguration objects that describe the pool's configuration.|
#### setPoolName

  ```solidity
  function setPoolName(uint128 poolId, string name) external
  ```

  Allows the owner of the pool to set the pool's name.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose name is being set.|
    |name|string|The new name to give to the pool.|

#### getPoolName

  ```solidity
  function getPoolName(uint128 poolId) external view returns (string poolName)
  ```

  Returns the pool's name.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose name is being queried.|

  | Name | Type | Description |
    |poolName|string|The current name of the pool.|
#### nominatePoolOwner

  ```solidity
  function nominatePoolOwner(address nominatedOwner, uint128 poolId) external
  ```

  Allows the current pool owner to nominate a new owner.

  | Name | Type | Description |
    |nominatedOwner|address|The address to nominate os the new pool owner.|
    |poolId|uint128|The id whose ownership is being transferred.|

#### acceptPoolOwnership

  ```solidity
  function acceptPoolOwnership(uint128 poolId) external
  ```

  After a new pool owner has been nominated, allows it to accept the nomination and thus ownership of the pool.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool for which the caller is to accept ownership.|

#### revokePoolNomination

  ```solidity
  function revokePoolNomination(uint128 poolId) external
  ```

  After a new pool owner has been nominated, allows it to reject the nomination.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool for which the new owner nomination is to be revoked.|

#### renouncePoolNomination

  ```solidity
  function renouncePoolNomination(uint128 poolId) external
  ```

  Allows the current nominated owner to renounce the nomination.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool for which the caller is renouncing ownership nomination.|

#### getPoolOwner

  ```solidity
  function getPoolOwner(uint128 poolId) external view returns (address owner)
  ```

  Returns the current pool owner.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose ownership is being queried.|

  | Name | Type | Description |
    |owner|address|The current owner of the pool.|
#### getNominatedPoolOwner

  ```solidity
  function getNominatedPoolOwner(uint128 poolId) external view returns (address nominatedOwner)
  ```

  Returns the current nominated pool owner.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose nominated owner is being queried.|

  | Name | Type | Description |
    |nominatedOwner|address|The current nominated owner of the pool.|
#### setMinLiquidityRatio

  ```solidity
  function setMinLiquidityRatio(uint256 minLiquidityRatio) external
  ```

  Allows the system owner (not the pool owner) to set the system-wide minimum liquidity ratio.

  | Name | Type | Description |
    |minLiquidityRatio|uint256|The new system-wide minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)|

#### getMinLiquidityRatio

  ```solidity
  function getMinLiquidityRatio() external view returns (uint256 minRatioD18)
  ```

  Retrieves the system-wide minimum liquidity ratio.

  | Name | Type | Description |
    |minRatioD18|uint256|The current system-wide minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)|

### Events

#### PoolCreated

  ```solidity
  event PoolCreated(uint128 poolId, address owner, address sender)
  ```

  Gets fired when pool will be created.

  | Name | Type | Description |
    |poolId|uint128|The id of the newly created pool.|
    |owner|address|The owner of the newly created pool.|
    |sender|address|The address that triggered the creation of the pool.|

#### PoolOwnerNominated

  ```solidity
  event PoolOwnerNominated(uint128 poolId, address nominatedOwner, address owner)
  ```

  Gets fired when pool owner proposes a new owner.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool for which the nomination ocurred.|
    |nominatedOwner|address|The address that was nominated as the new owner of the pool.|
    |owner|address|The address of the current owner of the pool.|

#### PoolOwnershipAccepted

  ```solidity
  event PoolOwnershipAccepted(uint128 poolId, address owner)
  ```

  Gets fired when pool nominee accepts nomination.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool for which the owner nomination was accepted.|
    |owner|address|The address of the new owner of the pool, which accepted the nomination.|

#### PoolNominationRevoked

  ```solidity
  event PoolNominationRevoked(uint128 poolId, address owner)
  ```

  Gets fired when pool owner revokes nomination.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool in which the nomination was revoked.|
    |owner|address|The current owner of the pool.|

#### PoolNominationRenounced

  ```solidity
  event PoolNominationRenounced(uint128 poolId, address owner)
  ```

  Gets fired when pool nominee renounces nomination.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool for which the owner nomination was renounced.|
    |owner|address|The current owner of the pool.|

#### PoolNameUpdated

  ```solidity
  event PoolNameUpdated(uint128 poolId, string name, address sender)
  ```

  Gets fired when pool name changes.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose name was updated.|
    |name|string|The new name of the pool.|
    |sender|address|The address that triggered the rename of the pool.|

#### PoolConfigurationSet

  ```solidity
  event PoolConfigurationSet(uint128 poolId, struct MarketConfiguration.Data[] markets, address sender)
  ```

  Gets fired when pool gets configured.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose configuration was set.|
    |markets|struct MarketConfiguration.Data[]|Array of configuration data of the markets that were connected to the pool.|
    |sender|address|The address that triggered the pool configuration.|

#### SetMinLiquidityRatio

  ```solidity
  event SetMinLiquidityRatio(uint256 minLiquidityRatio)
  ```

  Emitted when a system-wide minimum liquidity ratio is set

  | Name | Type | Description |
    |minLiquidityRatio|uint256|The new system-wide minimum liquidity ratio|

## Rewards Manager Module

### Functions

#### registerRewardsDistributor

  ```solidity
  function registerRewardsDistributor(uint128 poolId, address collateralType, address distributor) external
  ```

  Called by pool owner to register rewards for vault participants.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose rewards are to be managed by the specified distributor.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |distributor|address|The address of the reward distributor to be registered.|

#### removeRewardsDistributor

  ```solidity
  function removeRewardsDistributor(uint128 poolId, address collateralType, address distributor) external
  ```

  Called by pool owner to remove a registered rewards distributor for vault participants.
WARNING: if you remove a rewards distributor, the same address can never be re-registered again. If you
simply want to turn off
rewards, call `distributeRewards` with 0 emission. If you need to completely reset the rewards distributor
again, create a new rewards distributor at a new address and register the new one.
This function is provided since the number of rewards distributors added to an account is finite,
so you can remove an unused rewards distributor if need be.
NOTE: unclaimed rewards can still be claimed after a rewards distributor is removed (though any
rewards-over-time will be halted)

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose rewards are to be managed by the specified distributor.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |distributor|address|The address of the reward distributor to be registered.|

#### distributeRewards

  ```solidity
  function distributeRewards(uint128 poolId, address collateralType, uint256 amount, uint64 start, uint32 duration) external
  ```

  Called by a registered distributor to set up rewards for vault participants.

  Will revert if the caller is not a registered distributor.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool to distribute rewards to.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |amount|uint256|The amount of rewards to be distributed.|
    |start|uint64|The date at which the rewards will begin to be claimable.|
    |duration|uint32|The period after which all distributed rewards will be claimable.|

#### claimRewards

  ```solidity
  function claimRewards(uint128 accountId, uint128 poolId, address collateralType, address distributor) external returns (uint256 amountClaimedD18)
  ```

  Allows a user with appropriate permissions to claim rewards associated with a position.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that is to claim the rewards.|
    |poolId|uint128|The id of the pool to claim rewards on.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |distributor|address|The address of the rewards distributor associated with the rewards being claimed.|

  | Name | Type | Description |
    |amountClaimedD18|uint256|The amount of rewards that were available for the account and thus claimed.|
#### updateRewards

  ```solidity
  function updateRewards(uint128 poolId, address collateralType, uint128 accountId) external returns (uint256[] claimableD18, address[] distributors)
  ```

  For a given position, return the rewards that can currently be claimed.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool being queried.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |accountId|uint128|The id of the account whose available rewards are being queried.|

  | Name | Type | Description |
    |claimableD18|uint256[]|An array of ids of the reward entries that are claimable by the position.|
    |distributors|address[]|An array with the addresses of the reward distributors associated with the claimable rewards.|
#### getRewardRate

  ```solidity
  function getRewardRate(uint128 poolId, address collateralType, address distributor) external view returns (uint256 rateD18)
  ```

  Returns the number of individual units of amount emitted per second per share for the given poolId, collateralType, distributor vault.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool being queried.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |distributor|address|The address of the rewards distributor associated with the rewards in question.|

  | Name | Type | Description |
    |rateD18|uint256|The queried rewards rate.|

### Events

#### RewardsDistributed

  ```solidity
  event RewardsDistributed(uint128 poolId, address collateralType, address distributor, uint256 amount, uint256 start, uint256 duration)
  ```

  Emitted when the pool owner or an existing reward distributor sets up rewards for vault participants.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool on which rewards were distributed.|
    |collateralType|address|The collateral type of the pool on which rewards were distributed.|
    |distributor|address|The reward distributor associated to the rewards that were distributed.|
    |amount|uint256|The amount of rewards that were distributed.|
    |start|uint256|The date one which the rewards will begin to be claimable.|
    |duration|uint256|The time in which all of the distributed rewards will be claimable.|

#### RewardsClaimed

  ```solidity
  event RewardsClaimed(uint128 accountId, uint128 poolId, address collateralType, address distributor, uint256 amount)
  ```

  Emitted when a vault participant claims rewards.

  | Name | Type | Description |
    |accountId|uint128|The id of the account that claimed the rewards.|
    |poolId|uint128|The id of the pool where the rewards were claimed.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |distributor|address|The address of the rewards distributor associated with these rewards.|
    |amount|uint256|The amount of rewards that were claimed.|

#### RewardsDistributorRegistered

  ```solidity
  event RewardsDistributorRegistered(uint128 poolId, address collateralType, address distributor)
  ```

  Emitted when a new rewards distributor is registered.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose reward distributor was registered.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |distributor|address|The address of the newly registered reward distributor.|

#### RewardsDistributorRemoved

  ```solidity
  event RewardsDistributorRemoved(uint128 poolId, address collateralType, address distributor)
  ```

  Emitted when an already registered rewards distributor is removed.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool whose reward distributor was registered.|
    |collateralType|address|The address of the collateral used in the pool's rewards.|
    |distributor|address|The address of the registered reward distributor.|

## USD Token Module

### Functions

#### burnWithAllowance

  ```solidity
  function burnWithAllowance(address from, address spender, uint256 amount) external
  ```

  Allows the core system to burn snxUSD held by the `from` address, provided that it has given allowance to `spender`.

  | Name | Type | Description |
    |from|address|The address that holds the snxUSD to be burned.|
    |spender|address|The address to which the holder has given allowance to.|
    |amount|uint256|The amount of snxUSD to be burned, denominated with 18 decimals of precision.|

#### transferCrossChain

  ```solidity
  function transferCrossChain(uint256 destChainId, address to, uint256 amount) external returns (uint256 feesPaidD18)
  ```

  Allows users to transfer tokens cross-chain using CCIP. This is disabled until _CCIP_CHAINLINK_SEND is set in UtilsModule. This is currently included for testing purposes. Functionality will change, including fee collection, as CCIP continues development.

  | Name | Type | Description |
    |destChainId|uint256|The id of the chain where tokens are to be transferred to.|
    |to|address|The destination address in the target chain.|
    |amount|uint256|The amount of tokens to be transferred, denominated with 18 decimals of precision.|

  | Name | Type | Description |
    |feesPaidD18|uint256|The amount of fees paid in the cross-chain transfer, denominated with 18 decimals of precision.|
#### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns wether the token has been initialized.

  | Name | Type | Description |
    |[0]|bool|A boolean with the result of the query.|
#### initialize

  ```solidity
  function initialize(string tokenName, string tokenSymbol, uint8 tokenDecimals) external
  ```

  Initializes the token with name, symbol, and decimals.

#### mint

  ```solidity
  function mint(address to, uint256 amount) external
  ```

  Allows the owner to mint tokens.

  | Name | Type | Description |
    |to|address|The address to receive the newly minted tokens.|
    |amount|uint256|The amount of tokens to mint.|

#### burn

  ```solidity
  function burn(address from, uint256 amount) external
  ```

  Allows the owner to burn tokens.

  | Name | Type | Description |
    |from|address|The address whose tokens will be burnt.|
    |amount|uint256|The amount of tokens to burn.|

#### setAllowance

  ```solidity
  function setAllowance(address from, address spender, uint256 amount) external
  ```

  Allows an address that holds tokens to provide allowance to another.

  | Name | Type | Description |
    |from|address|The address that is providing allowance.|
    |spender|address|The address that is given allowance.|
    |amount|uint256|The amount of allowance being given.|

#### name

  ```solidity
  function name() external view returns (string)
  ```

  Retrieves the name of the token, e.g. "Synthetix Network Token".

  | Name | Type | Description |
    |[0]|string|A string with the name of the token.|
#### symbol

  ```solidity
  function symbol() external view returns (string)
  ```

  Retrieves the symbol of the token, e.g. "SNX".

  | Name | Type | Description |
    |[0]|string|A string with the symbol of the token.|
#### decimals

  ```solidity
  function decimals() external view returns (uint8)
  ```

  Retrieves the number of decimals used by the token. The default is 18.

  | Name | Type | Description |
    |[0]|uint8|The number of decimals.|
#### totalSupply

  ```solidity
  function totalSupply() external view returns (uint256)
  ```

  Returns the total number of tokens in circulation (minted - burnt).

  | Name | Type | Description |
    |[0]|uint256|The total number of tokens.|
#### balanceOf

  ```solidity
  function balanceOf(address owner) external view returns (uint256)
  ```

  Returns the balance of a user.

  | Name | Type | Description |
    |owner|address|The address whose balance is being retrieved.|

  | Name | Type | Description |
    |[0]|uint256|The number of tokens owned by the user.|
#### allowance

  ```solidity
  function allowance(address owner, address spender) external view returns (uint256)
  ```

  Returns how many tokens a user has allowed another user to transfer on its behalf.

  | Name | Type | Description |
    |owner|address|The user who has given the allowance.|
    |spender|address|The user who was given the allowance.|

  | Name | Type | Description |
    |[0]|uint256|The amount of tokens `spender` can transfer on `owner`'s behalf.|
#### transfer

  ```solidity
  function transfer(address to, uint256 amount) external returns (bool)
  ```

  Transfer tokens from one address to another.

  | Name | Type | Description |
    |to|address|The address that will receive the tokens.|
    |amount|uint256|The amount of tokens to be transferred.|

  | Name | Type | Description |
    |[0]|bool|A boolean which is true if the operation succeeded.|
#### approve

  ```solidity
  function approve(address spender, uint256 amount) external returns (bool)
  ```

  Allows users to provide allowance to other users so that they can transfer tokens on their behalf.

  | Name | Type | Description |
    |spender|address|The address that is receiving the allowance.|
    |amount|uint256|The amount of tokens that are being added to the allowance.|

  | Name | Type | Description |
    |[0]|bool|A boolean which is true if the operation succeeded.|
#### increaseAllowance

  ```solidity
  function increaseAllowance(address spender, uint256 addedValue) external returns (bool)
  ```

  Atomically increases the allowance granted to `spender` by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- `spender` cannot be the zero address.

#### decreaseAllowance

  ```solidity
  function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool)
  ```

  Atomically decreases the allowance granted to `spender` by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- `spender` cannot be the zero address.
- `spender` must have allowance for the caller of at least
`subtractedValue`.

#### transferFrom

  ```solidity
  function transferFrom(address from, address to, uint256 amount) external returns (bool)
  ```

  Allows a user who has been given allowance to transfer tokens on another user's behalf.

  | Name | Type | Description |
    |from|address|The address that owns the tokens that are being transferred.|
    |to|address|The address that will receive the tokens.|
    |amount|uint256|The number of tokens to transfer.|

  | Name | Type | Description |
    |[0]|bool|A boolean which is true if the operation succeeded.|

### Events

#### Transfer

  ```solidity
  event Transfer(address from, address to, uint256 amount)
  ```

  Emitted when tokens have been transferred.

  | Name | Type | Description |
    |from|address|The address that originally owned the tokens.|
    |to|address|The address that received the tokens.|
    |amount|uint256|The number of tokens that were transferred.|

#### Approval

  ```solidity
  event Approval(address owner, address spender, uint256 amount)
  ```

  Emitted when a user has provided allowance to another user for transferring tokens on its behalf.

  | Name | Type | Description |
    |owner|address|The address that is providing the allowance.|
    |spender|address|The address that received the allowance.|
    |amount|uint256|The number of tokens that were added to `spender`'s allowance.|

## Vault Module

### Functions

#### delegateCollateral

  ```solidity
  function delegateCollateral(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, uint256 leverage) external
  ```

  Updates an account's delegated collateral amount for the specified pool and collateral type pair.

  | Name | Type | Description |
    |accountId|uint128|The id of the account associated with the position that will be updated.|
    |poolId|uint128|The id of the pool associated with the position.|
    |collateralType|address|The address of the collateral used in the position.|
    |amount|uint256|The new amount of collateral delegated in the position, denominated with 18 decimals of precision.|
    |leverage|uint256|The new leverage amount used in the position, denominated with 18 decimals of precision. Requirements: - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DELEGATE` permission. - If increasing the amount delegated, it must not exceed the available collateral (`getAccountAvailableCollateral`) associated with the account. - If decreasing the amount delegated, the liquidity position must have a collateralization ratio greater than the target collateralization ratio for the corresponding collateral type. Emits a {DelegationUpdated} event.|

#### getPositionCollateralRatio

  ```solidity
  function getPositionCollateralRatio(uint128 accountId, uint128 poolId, address collateralType) external returns (uint256 ratioD18)
  ```

  Returns the collateralization ratio of the specified liquidity position. If debt is negative, this function will return 0.

  Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose collateralization ratio is being queried.|
    |poolId|uint128|The id of the pool in which the account's position is held.|
    |collateralType|address|The address of the collateral used in the queried position.|

  | Name | Type | Description |
    |ratioD18|uint256|The collateralization ratio of the position (collateral / debt), denominated with 18 decimals of precision.|
#### getPositionDebt

  ```solidity
  function getPositionDebt(uint128 accountId, uint128 poolId, address collateralType) external returns (int256 debtD18)
  ```

  Returns the debt of the specified liquidity position. Credit is expressed as negative debt.

  This is not a view function, and actually updates the entire debt distribution chain.
Call this function using `callStatic` to treat it as a view function.

  | Name | Type | Description |
    |accountId|uint128|The id of the account being queried.|
    |poolId|uint128|The id of the pool in which the account's position is held.|
    |collateralType|address|The address of the collateral used in the queried position.|

  | Name | Type | Description |
    |debtD18|int256|The amount of debt held by the position, denominated with 18 decimals of precision.|
#### getPositionCollateral

  ```solidity
  function getPositionCollateral(uint128 accountId, uint128 poolId, address collateralType) external view returns (uint256 collateralAmountD18, uint256 collateralValueD18)
  ```

  Returns the amount and value of the collateral associated with the specified liquidity position.

  Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType.

  | Name | Type | Description |
    |accountId|uint128|The id of the account being queried.|
    |poolId|uint128|The id of the pool in which the account's position is held.|
    |collateralType|address|The address of the collateral used in the queried position.|

  | Name | Type | Description |
    |collateralAmountD18|uint256|The amount of collateral used in the position, denominated with 18 decimals of precision.|
    |collateralValueD18|uint256|The value of collateral used in the position, denominated with 18 decimals of precision.|
#### getPosition

  ```solidity
  function getPosition(uint128 accountId, uint128 poolId, address collateralType) external returns (uint256 collateralAmountD18, uint256 collateralValueD18, int256 debtD18, uint256 collateralizationRatioD18)
  ```

  Returns all information pertaining to a specified liquidity position in the vault module.

  | Name | Type | Description |
    |accountId|uint128|The id of the account being queried.|
    |poolId|uint128|The id of the pool in which the account's position is held.|
    |collateralType|address|The address of the collateral used in the queried position.|

  | Name | Type | Description |
    |collateralAmountD18|uint256|The amount of collateral used in the position, denominated with 18 decimals of precision.|
    |collateralValueD18|uint256|The value of the collateral used in the position, denominated with 18 decimals of precision.|
    |debtD18|int256|The amount of debt held in the position, denominated with 18 decimals of precision.|
    |collateralizationRatioD18|uint256|The collateralization ratio of the position (collateral / debt), denominated with 18 decimals of precision.|
#### getVaultDebt

  ```solidity
  function getVaultDebt(uint128 poolId, address collateralType) external returns (int256 debtD18)
  ```

  Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.

  This is not a view function, and actually updates the entire debt distribution chain.
Call this function using `callStatic` to treat it as a view function.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool that owns the vault whose debt is being queried.|
    |collateralType|address|The address of the collateral of the associated vault.|

  | Name | Type | Description |
    |debtD18|int256|The overall debt of the vault, denominated with 18 decimals of precision.|
#### getVaultCollateral

  ```solidity
  function getVaultCollateral(uint128 poolId, address collateralType) external returns (uint256 collateralAmountD18, uint256 collateralValueD18)
  ```

  Returns the amount and value of the collateral held by the vault.

  Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool that owns the vault whose collateral is being queried.|
    |collateralType|address|The address of the collateral of the associated vault.|

  | Name | Type | Description |
    |collateralAmountD18|uint256|The collateral amount of the vault, denominated with 18 decimals of precision.|
    |collateralValueD18|uint256|The collateral value of the vault, denominated with 18 decimals of precision.|
#### getVaultCollateralRatio

  ```solidity
  function getVaultCollateralRatio(uint128 poolId, address collateralType) external returns (uint256 ratioD18)
  ```

  Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.

  Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places.

  | Name | Type | Description |
    |poolId|uint128|The id of the pool that owns the vault whose collateralization ratio is being queried.|
    |collateralType|address|The address of the collateral of the associated vault.|

  | Name | Type | Description |
    |ratioD18|uint256|The collateralization ratio of the vault, denominated with 18 decimals of precision.|

### Events

#### DelegationUpdated

  ```solidity
  event DelegationUpdated(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, uint256 leverage, address sender)
  ```

  Emitted when {sender} updates the delegation of collateral in the specified liquidity position.

  | Name | Type | Description |
    |accountId|uint128|The id of the account whose position was updated.|
    |poolId|uint128|The id of the pool in which the position was updated.|
    |collateralType|address|The address of the collateral associated to the position.|
    |amount|uint256|The new amount of the position, denominated with 18 decimals of precision.|
    |leverage|uint256|The new leverage value of the position, denominated with 18 decimals of precision.|
    |sender|address|The address that triggered the update of the position.|

