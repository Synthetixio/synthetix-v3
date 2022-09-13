# Solidity API

## Liquidation Module

### Liquidation

  ```solidity
  event Liquidation(uint256 accountId, uint256 poolId, address collateralType, uint256 debtLiquidated, uint256 collateralLiquidated, uint256 amountRewarded)
  ```

### VaultLiquidation

  ```solidity
  event VaultLiquidation(uint256 poolId, address collateralType, uint256 debtLiquidated, uint256 collateralLiquidated, uint256 amountRewarded)
  ```

### LiquidationInformation

```solidity
struct LiquidationInformation {
  struct CurvesLibrary.PolynomialCurve curve;
  mapping(uint256 => uint256) initialAmount;
  uint256 accumulated;
}
```
### liquidate

  ```solidity
  function liquidate(uint256 accountId, uint256 poolId, address collateralType) external returns (uint256 amountRewarded, uint256 debtLiquidated, uint256 collateralLiquidated)
  ```

liquidates the required collateral of the account delegated to the poolId

### liquidateVault

  ```solidity
  function liquidateVault(uint256 poolId, address collateralType, uint256 liquidateAsAccountId, uint256 maxUsd) external returns (uint256 amountRewarded, uint256 collateralLiquidated)
  ```

liquidates an entire vault. can only be done if the vault itself is undercollateralized.
liquidateAsAccountId determines which account to deposit the siezed collateral into (this is necessary particularly if the collateral in the vault is vesting)
Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied

### isLiquidatable

  ```solidity
  function isLiquidatable(uint256 accountId, uint256 poolId, address collateralType) external returns (bool)
  ```

returns if the account is liquidable on the poolId - collateralType pair

### Liquidation

  ```solidity
  event Liquidation(uint256 accountId, uint256 poolId, address collateralType, uint256 debtLiquidated, uint256 collateralLiquidated, uint256 amountRewarded)
  ```

### VaultLiquidation

  ```solidity
  event VaultLiquidation(uint256 poolId, address collateralType, uint256 debtLiquidated, uint256 collateralLiquidated, uint256 amountRewarded)
  ```

### LiquidationInformation

```solidity
struct LiquidationInformation {
  struct CurvesLibrary.PolynomialCurve curve;
  mapping(uint256 => uint256) initialAmount;
  uint256 accumulated;
}
```
### liquidate

  ```solidity
  function liquidate(uint256 accountId, uint256 poolId, address collateralType) external returns (uint256 amountRewarded, uint256 debtLiquidated, uint256 collateralLiquidated)
  ```

liquidates the required collateral of the account delegated to the poolId

### liquidateVault

  ```solidity
  function liquidateVault(uint256 poolId, address collateralType, uint256 liquidateAsAccountId, uint256 maxUsd) external returns (uint256 amountRewarded, uint256 collateralLiquidated)
  ```

liquidates an entire vault. can only be done if the vault itself is undercollateralized.
liquidateAsAccountId determines which account to deposit the siezed collateral into (this is necessary particularly if the collateral in the vault is vesting)
Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied

### isLiquidatable

  ```solidity
  function isLiquidatable(uint256 accountId, uint256 poolId, address collateralType) external returns (bool)
  ```

returns if the account is liquidable on the poolId - collateralType pair

## Market Manager Module

### MarketRegistered

  ```solidity
  event MarketRegistered(address market, uint256 marketId)
  ```

### UsdDeposited

  ```solidity
  event UsdDeposited(uint256 marketId, address target, uint256 amount, address sender)
  ```

### UsdWithdrawn

  ```solidity
  event UsdWithdrawn(uint256 marketId, address target, uint256 amount, address sender)
  ```

### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint256)
  ```

registers a new market

### depositUsd

  ```solidity
  function depositUsd(uint256 marketId, address target, uint256 amount) external
  ```

target deposits amount of synths to the marketId

### withdrawUsd

  ```solidity
  function withdrawUsd(uint256 marketId, address target, uint256 amount) external
  ```

target withdraws amount of synths to the marketId

### getWithdrawableUsd

  ```solidity
  function getWithdrawableUsd(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### getMarketIssuance

  ```solidity
  function getMarketIssuance(uint256 marketId) external view returns (int128)
  ```

gets net snxUSD withdrawn - deposited by the market

### getMarketReportedBalance

  ```solidity
  function getMarketReportedBalance(uint256 marketId) external view returns (uint256)
  ```

gets the total balance of the market

### getMarketTotalBalance

  ```solidity
  function getMarketTotalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market (marketIssuance + marketReportedBalance)

### getMarketCollateral

  ```solidity
  function getMarketCollateral(uint256 marketId) external view returns (uint256)
  ```

gets the snxUSD value of the collateral backing this market.

### getMarketDebtPerShare

  ```solidity
  function getMarketDebtPerShare(uint256 marketId) external returns (int256)
  ```

### MarketRegistered

  ```solidity
  event MarketRegistered(address market, uint256 marketId)
  ```

### UsdDeposited

  ```solidity
  event UsdDeposited(uint256 marketId, address target, uint256 amount, address sender)
  ```

### UsdWithdrawn

  ```solidity
  event UsdWithdrawn(uint256 marketId, address target, uint256 amount, address sender)
  ```

### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint256)
  ```

registers a new market

### depositUsd

  ```solidity
  function depositUsd(uint256 marketId, address target, uint256 amount) external
  ```

target deposits amount of synths to the marketId

### withdrawUsd

  ```solidity
  function withdrawUsd(uint256 marketId, address target, uint256 amount) external
  ```

target withdraws amount of synths to the marketId

### getWithdrawableUsd

  ```solidity
  function getWithdrawableUsd(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### getMarketIssuance

  ```solidity
  function getMarketIssuance(uint256 marketId) external view returns (int128)
  ```

gets net snxUSD withdrawn - deposited by the market

### getMarketReportedBalance

  ```solidity
  function getMarketReportedBalance(uint256 marketId) external view returns (uint256)
  ```

gets the total balance of the market

### getMarketTotalBalance

  ```solidity
  function getMarketTotalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market (marketIssuance + marketReportedBalance)

### getMarketCollateral

  ```solidity
  function getMarketCollateral(uint256 marketId) external view returns (uint256)
  ```

gets the snxUSD value of the collateral backing this market.

### getMarketDebtPerShare

  ```solidity
  function getMarketDebtPerShare(uint256 marketId) external returns (int256)
  ```

## Pool Configuration Module

### PreferredPoolSet

  ```solidity
  event PreferredPoolSet(uint256 poolId)
  ```

### PoolApprovedAdded

  ```solidity
  event PoolApprovedAdded(uint256 poolId)
  ```

### PoolApprovedRemoved

  ```solidity
  event PoolApprovedRemoved(uint256 poolId)
  ```

### setPreferredPool

  ```solidity
  function setPreferredPool(uint256 poolId) external
  ```

SCCP sets the preferred pool

### addApprovedPool

  ```solidity
  function addApprovedPool(uint256 poolId) external
  ```

SCCP adds a poolId to the approved list

### removeApprovedPool

  ```solidity
  function removeApprovedPool(uint256 poolId) external
  ```

SCCP removes a poolId to the approved list

### getPreferredPool

  ```solidity
  function getPreferredPool() external view returns (uint256)
  ```

gets the preferred pool

### getApprovedPools

  ```solidity
  function getApprovedPools() external view returns (uint256[])
  ```

gets the approved pools (list of poolIds)

### PreferredPoolSet

  ```solidity
  event PreferredPoolSet(uint256 poolId)
  ```

### PoolApprovedAdded

  ```solidity
  event PoolApprovedAdded(uint256 poolId)
  ```

### PoolApprovedRemoved

  ```solidity
  event PoolApprovedRemoved(uint256 poolId)
  ```

### setPreferredPool

  ```solidity
  function setPreferredPool(uint256 poolId) external
  ```

SCCP sets the preferred pool

### addApprovedPool

  ```solidity
  function addApprovedPool(uint256 poolId) external
  ```

SCCP adds a poolId to the approved list

### removeApprovedPool

  ```solidity
  function removeApprovedPool(uint256 poolId) external
  ```

SCCP removes a poolId to the approved list

### getPreferredPool

  ```solidity
  function getPreferredPool() external view returns (uint256)
  ```

gets the preferred pool

### getApprovedPools

  ```solidity
  function getApprovedPools() external view returns (uint256[])
  ```

gets the approved pools (list of poolIds)

## Pool Module

### PoolCreated

  ```solidity
  event PoolCreated(uint256 poolId, address owner)
  ```

### NominatedPoolOwner

  ```solidity
  event NominatedPoolOwner(uint256 poolId, address owner)
  ```

### PoolOwnershipAccepted

  ```solidity
  event PoolOwnershipAccepted(uint256 poolId, address owner)
  ```

### PoolNominationRenounced

  ```solidity
  event PoolNominationRenounced(uint256 poolId, address owner)
  ```

### PoolNominationRevoked

  ```solidity
  event PoolNominationRevoked(uint256 poolId, address owner)
  ```

### PoolOwnershipRenounced

  ```solidity
  event PoolOwnershipRenounced(uint256 poolId, address owner)
  ```

### PoolNameUpdated

  ```solidity
  event PoolNameUpdated(uint256 poolId, string name, address sender)
  ```

### PoolConfigurationSet

  ```solidity
  event PoolConfigurationSet(uint256 poolId, uint256[] markets, uint256[] weights, address executedBy)
  ```

### createPool

  ```solidity
  function createPool(uint256 requestedPoolId, address owner) external
  ```

creates a new pool

### setPoolConfiguration

  ```solidity
  function setPoolConfiguration(uint256 poolId, uint256[] markets, uint256[] weights, int256[] maxDebtShareValues) external
  ```

sets the pool positions (only poolToken owner)

### getPoolConfiguration

  ```solidity
  function getPoolConfiguration(uint256 poolId) external view returns (uint256[] markets, uint256[] weights, int256[] maxDebtShareValues)
  ```

gets the pool positions

### setPoolName

  ```solidity
  function setPoolName(uint256 poolId, string name) external
  ```

sets the pool name

### getPoolName

  ```solidity
  function getPoolName(uint256 poolId) external view returns (string poolName)
  ```

gets the pool name

### nominatePoolOwner

  ```solidity
  function nominatePoolOwner(address nominatedOwner, uint256 poolId) external
  ```

nominates a new pool owner

### acceptPoolOwnership

  ```solidity
  function acceptPoolOwnership(uint256 poolId) external
  ```

accepts ownership by nominated owner

### renouncePoolNomination

  ```solidity
  function renouncePoolNomination(uint256 poolId) external
  ```

renounces nomination by nominated owner

### renouncePoolOwnership

  ```solidity
  function renouncePoolOwnership(uint256 poolId) external
  ```

renounces ownership by owner

### getPoolOwner

  ```solidity
  function getPoolOwner(uint256 poolId) external view returns (address)
  ```

gets owner of poolId

### getNominatedPoolOwner

  ```solidity
  function getNominatedPoolOwner(uint256 poolId) external view returns (address)
  ```

gets nominatedOwner of poolId

### setMinLiquidityRatio

  ```solidity
  function setMinLiquidityRatio(uint256 minLiquidityRatio) external
  ```

places a cap on what proportion of free vault liquidity may be used towards a pool. only owner.

### getMinLiquidityRatio

  ```solidity
  function getMinLiquidityRatio() external view returns (uint256)
  ```

returns the liquidity ratio cap for delegation of liquidity by pools to markets

### PoolCreated

  ```solidity
  event PoolCreated(uint256 poolId, address owner)
  ```

### NominatedPoolOwner

  ```solidity
  event NominatedPoolOwner(uint256 poolId, address owner)
  ```

### PoolOwnershipAccepted

  ```solidity
  event PoolOwnershipAccepted(uint256 poolId, address owner)
  ```

### PoolNominationRenounced

  ```solidity
  event PoolNominationRenounced(uint256 poolId, address owner)
  ```

### PoolNominationRevoked

  ```solidity
  event PoolNominationRevoked(uint256 poolId, address owner)
  ```

### PoolOwnershipRenounced

  ```solidity
  event PoolOwnershipRenounced(uint256 poolId, address owner)
  ```

### PoolNameUpdated

  ```solidity
  event PoolNameUpdated(uint256 poolId, string name, address sender)
  ```

### PoolConfigurationSet

  ```solidity
  event PoolConfigurationSet(uint256 poolId, uint256[] markets, uint256[] weights, address executedBy)
  ```

### createPool

  ```solidity
  function createPool(uint256 requestedPoolId, address owner) external
  ```

creates a new pool

### setPoolConfiguration

  ```solidity
  function setPoolConfiguration(uint256 poolId, uint256[] markets, uint256[] weights, int256[] maxDebtShareValues) external
  ```

sets the pool positions (only poolToken owner)

### getPoolConfiguration

  ```solidity
  function getPoolConfiguration(uint256 poolId) external view returns (uint256[] markets, uint256[] weights, int256[] maxDebtShareValues)
  ```

gets the pool positions

### setPoolName

  ```solidity
  function setPoolName(uint256 poolId, string name) external
  ```

sets the pool name

### getPoolName

  ```solidity
  function getPoolName(uint256 poolId) external view returns (string poolName)
  ```

gets the pool name

### nominatePoolOwner

  ```solidity
  function nominatePoolOwner(address nominatedOwner, uint256 poolId) external
  ```

nominates a new pool owner

### acceptPoolOwnership

  ```solidity
  function acceptPoolOwnership(uint256 poolId) external
  ```

accepts ownership by nominated owner

### renouncePoolNomination

  ```solidity
  function renouncePoolNomination(uint256 poolId) external
  ```

renounces nomination by nominated owner

### renouncePoolOwnership

  ```solidity
  function renouncePoolOwnership(uint256 poolId) external
  ```

renounces ownership by owner

### getPoolOwner

  ```solidity
  function getPoolOwner(uint256 poolId) external view returns (address)
  ```

gets owner of poolId

### getNominatedPoolOwner

  ```solidity
  function getNominatedPoolOwner(uint256 poolId) external view returns (address)
  ```

gets nominatedOwner of poolId

### setMinLiquidityRatio

  ```solidity
  function setMinLiquidityRatio(uint256 minLiquidityRatio) external
  ```

places a cap on what proportion of free vault liquidity may be used towards a pool. only owner.

### getMinLiquidityRatio

  ```solidity
  function getMinLiquidityRatio() external view returns (uint256)
  ```

returns the liquidity ratio cap for delegation of liquidity by pools to markets

## Rewards Manager Module

### RewardDistributed

  ```solidity
  event RewardDistributed(uint256 poolId, address token, uint256 index, address distributor, uint256 totalRewarded, uint256 start, uint256 duration)
  ```

### RewardsClaimed

  ```solidity
  event RewardsClaimed(uint256 poolId, address token, uint256 accountId, uint256 index, uint256 amountClaimed)
  ```

### distributeRewards

  ```solidity
  function distributeRewards(uint256 poolId, address token, uint256 index, address distributor, uint256 amount, uint256 start, uint256 duration) external
  ```

called by pool owner or an existing distributor to set up rewards for vault participants

### claimRewards

  ```solidity
  function claimRewards(uint256 poolId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards, and claims them to the caller's account.

### getAvailableRewards

  ```solidity
  function getAvailableRewards(uint256 poolId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards.

  _this function should be called to get currently available rewards using `callStatic`_

### getCurrentRewardAccumulation

  ```solidity
  function getCurrentRewardAccumulation(uint256 poolId, address collateralType) external view returns (uint256[])
  ```

returns the number of individual units of amount emitted per second per share for the given poolId, collateralType vault

### RewardDistributed

  ```solidity
  event RewardDistributed(uint256 poolId, address token, uint256 index, address distributor, uint256 totalRewarded, uint256 start, uint256 duration)
  ```

### RewardsClaimed

  ```solidity
  event RewardsClaimed(uint256 poolId, address token, uint256 accountId, uint256 index, uint256 amountClaimed)
  ```

### distributeRewards

  ```solidity
  function distributeRewards(uint256 poolId, address token, uint256 index, address distributor, uint256 amount, uint256 start, uint256 duration) external
  ```

called by pool owner or an existing distributor to set up rewards for vault participants

### claimRewards

  ```solidity
  function claimRewards(uint256 poolId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards, and claims them to the caller's account.

### getAvailableRewards

  ```solidity
  function getAvailableRewards(uint256 poolId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards.

  _this function should be called to get currently available rewards using `callStatic`_

### getCurrentRewardAccumulation

  ```solidity
  function getCurrentRewardAccumulation(uint256 poolId, address collateralType) external view returns (uint256[])
  ```

returns the number of individual units of amount emitted per second per share for the given poolId, collateralType vault

## USD Token Module

### initializeUSDTokenModule

  ```solidity
  function initializeUSDTokenModule() external
  ```

initializes the USD Token Module. Creates the first USD token implementation and takes ownership by the system

### isUSDTokenModuleInitialized

  ```solidity
  function isUSDTokenModuleInitialized() external view returns (bool)
  ```

shows whether the module has been initialized

### upgradeUSDImplementation

  ```solidity
  function upgradeUSDImplementation(address newUSDTokenImplementation) external
  ```

upgrades the USDToken implementation.

### getUSDTokenAddress

  ```solidity
  function getUSDTokenAddress() external view returns (address)
  ```

gets the USDToken address.

### initializeUSDTokenModule

  ```solidity
  function initializeUSDTokenModule() external
  ```

initializes the USD Token Module. Creates the first USD token implementation and takes ownership by the system

### isUSDTokenModuleInitialized

  ```solidity
  function isUSDTokenModuleInitialized() external view returns (bool)
  ```

shows whether the module has been initialized

### upgradeUSDImplementation

  ```solidity
  function upgradeUSDImplementation(address newUSDTokenImplementation) external
  ```

upgrades the USDToken implementation.

### getUSDTokenAddress

  ```solidity
  function getUSDTokenAddress() external view returns (address)
  ```

gets the USDToken address.

## Vault Module

### DelegationUpdated

  ```solidity
  event DelegationUpdated(uint256 accountId, uint256 poolId, address collateralType, uint256 amount, uint256 leverage, address sender)
  ```

Emitted when {sender} updates the delegation of collateral in the specified staking position.

### UsdMinted

  ```solidity
  event UsdMinted(uint256 accountId, uint256 poolId, address collateralType, uint256 amount, address sender)
  ```

Emitted when {sender} mints {amount} of snxUSD with the specified staking position.

### UsdBurned

  ```solidity
  event UsdBurned(uint256 accountId, uint256 poolId, address collateralType, uint256 amount, address sender)
  ```

Emitted when {sender} burns {amount} of snxUSD with the specified staking position.

### delegateCollateral

  ```solidity
  function delegateCollateral(uint256 accountId, uint256 poolId, address collateralType, uint256 amount, uint256 leverage) external
  ```

Delegates (creates, adjust or remove a delegation) collateral from an account.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DELEGATE` permission.
- If increasing the amount delegated, it must not exceed the available collateral (`getAccountAvailableCollateral`) associated with the account.
- If decreasing the amount delegated, the staking position must have a colalteralization ratio greater than the target collateralization ratio for the corresponding collateral type.

Emits a {DelegationUpdated} event.

### mintUsd

  ```solidity
  function mintUsd(uint256 accountId, uint256 poolId, address collateralType, uint256 amount) external
  ```

Mints {amount} of snxUSD with the specified staking position.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `MINT` permission.
- After minting, the collateralization ratio of the staking position must not be below the target collateralization ratio for the corresponding collateral type.

Emits a {UsdMinted} event.

### burnUsd

  ```solidity
  function burnUsd(uint256 accountId, uint256 poolId, address collateralType, uint256 amount) external
  ```

Burns {amount} of snxUSD with the specified staking position.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `BURN` permission.

Emits a {UsdMinted} event.

### getPositionCollateralizationRatio

  ```solidity
  function getPositionCollateralizationRatio(uint256 accountId, uint256 poolId, address collateralType) external returns (uint256)
  ```

Returns the collateralization ratio of the specified staking position. If debt is negative, this function will return 0.

  _Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places._

### getPositionDebt

  ```solidity
  function getPositionDebt(uint256 accountId, uint256 poolId, address collateralType) external returns (int256)
  ```

Returns the debt of the specified staking position. Credit is expressed as negative debt.

  _Call this function using `callStatic` to treat it as a view function.
The return value is denominated in dollars with 18 decimal places._

### getPositionCollateral

  ```solidity
  function getPositionCollateral(uint256 accountId, uint256 poolId, address collateralType) external view returns (uint256 collateralAmount, uint256 collateralValue)
  ```

Returns the amount and value of the collateral associated with the specified staking position.

  _Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType._

### getPosition

  ```solidity
  function getPosition(uint256 accountId, uint256 poolId, address collateralType) external returns (uint256 collateralAmount, uint256 collateralValue, int256 debt, uint256 collateralizationRatio)
  ```

Returns all information pertaining to a specified staking position in the vault module.

### getVaultDebt

  ```solidity
  function getVaultDebt(uint256 poolId, address collateralType) external returns (int256)
  ```

Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.

  _Call this function using `callStatic` to treat it as a view function.
The return value is denominated in dollars with 18 decimal places._

### getVaultCollateral

  ```solidity
  function getVaultCollateral(uint256 poolId, address collateralType) external returns (uint256 collateralAmount, uint256 collateralValue)
  ```

Returns the amount and value of the collateral held by the vault.

  _Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType._

### getVaultCollateralRatio

  ```solidity
  function getVaultCollateralRatio(uint256 poolId, address collateralType) external returns (uint256)
  ```

Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.

  _Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places._

### DelegationUpdated

  ```solidity
  event DelegationUpdated(uint256 accountId, uint256 poolId, address collateralType, uint256 amount, uint256 leverage, address sender)
  ```

Emitted when {sender} updates the delegation of collateral in the specified staking position.

### UsdMinted

  ```solidity
  event UsdMinted(uint256 accountId, uint256 poolId, address collateralType, uint256 amount, address sender)
  ```

Emitted when {sender} mints {amount} of snxUSD with the specified staking position.

### UsdBurned

  ```solidity
  event UsdBurned(uint256 accountId, uint256 poolId, address collateralType, uint256 amount, address sender)
  ```

Emitted when {sender} burns {amount} of snxUSD with the specified staking position.

### delegateCollateral

  ```solidity
  function delegateCollateral(uint256 accountId, uint256 poolId, address collateralType, uint256 amount, uint256 leverage) external
  ```

Delegates (creates, adjust or remove a delegation) collateral from an account.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DELEGATE` permission.
- If increasing the amount delegated, it must not exceed the available collateral (`getAccountAvailableCollateral`) associated with the account.
- If decreasing the amount delegated, the staking position must have a colalteralization ratio greater than the target collateralization ratio for the corresponding collateral type.

Emits a {DelegationUpdated} event.

### mintUsd

  ```solidity
  function mintUsd(uint256 accountId, uint256 poolId, address collateralType, uint256 amount) external
  ```

Mints {amount} of snxUSD with the specified staking position.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `MINT` permission.
- After minting, the collateralization ratio of the staking position must not be below the target collateralization ratio for the corresponding collateral type.

Emits a {UsdMinted} event.

### burnUsd

  ```solidity
  function burnUsd(uint256 accountId, uint256 poolId, address collateralType, uint256 amount) external
  ```

Burns {amount} of snxUSD with the specified staking position.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `BURN` permission.

Emits a {UsdMinted} event.

### getPositionCollateralizationRatio

  ```solidity
  function getPositionCollateralizationRatio(uint256 accountId, uint256 poolId, address collateralType) external returns (uint256)
  ```

Returns the collateralization ratio of the specified staking position. If debt is negative, this function will return 0.

  _Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places._

### getPositionDebt

  ```solidity
  function getPositionDebt(uint256 accountId, uint256 poolId, address collateralType) external returns (int256)
  ```

Returns the debt of the specified staking position. Credit is expressed as negative debt.

  _Call this function using `callStatic` to treat it as a view function.
The return value is denominated in dollars with 18 decimal places._

### getPositionCollateral

  ```solidity
  function getPositionCollateral(uint256 accountId, uint256 poolId, address collateralType) external view returns (uint256 collateralAmount, uint256 collateralValue)
  ```

Returns the amount and value of the collateral associated with the specified staking position.

  _Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType._

### getPosition

  ```solidity
  function getPosition(uint256 accountId, uint256 poolId, address collateralType) external returns (uint256 collateralAmount, uint256 collateralValue, int256 debt, uint256 collateralizationRatio)
  ```

Returns all information pertaining to a specified staking position in the vault module.

### getVaultDebt

  ```solidity
  function getVaultDebt(uint256 poolId, address collateralType) external returns (int256)
  ```

Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.

  _Call this function using `callStatic` to treat it as a view function.
The return value is denominated in dollars with 18 decimal places._

### getVaultCollateral

  ```solidity
  function getVaultCollateral(uint256 poolId, address collateralType) external returns (uint256 collateralAmount, uint256 collateralValue)
  ```

Returns the amount and value of the collateral held by the vault.

  _Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType._

### getVaultCollateralRatio

  ```solidity
  function getVaultCollateralRatio(uint256 poolId, address collateralType) external returns (uint256)
  ```

Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.

  _Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places._

## Market Manager Module

### MarketRegistered

  ```solidity
  event MarketRegistered(address market, uint256 marketId)
  ```

### UsdDeposited

  ```solidity
  event UsdDeposited(uint256 marketId, address target, uint256 amount, address sender)
  ```

### UsdWithdrawn

  ```solidity
  event UsdWithdrawn(uint256 marketId, address target, uint256 amount, address sender)
  ```

### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint256)
  ```

registers a new market

### depositUsd

  ```solidity
  function depositUsd(uint256 marketId, address target, uint256 amount) external
  ```

target deposits amount of synths to the marketId

### withdrawUsd

  ```solidity
  function withdrawUsd(uint256 marketId, address target, uint256 amount) external
  ```

target withdraws amount of synths to the marketId

### getWithdrawableUsd

  ```solidity
  function getWithdrawableUsd(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### getMarketIssuance

  ```solidity
  function getMarketIssuance(uint256 marketId) external view returns (int128)
  ```

gets net snxUSD withdrawn - deposited by the market

### getMarketReportedDebt

  ```solidity
  function getMarketReportedDebt(uint256 marketId) external view returns (uint256)
  ```

gets the total balance of the market

### getMarketTotalBalance

  ```solidity
  function getMarketTotalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market (marketIssuance + marketReportedDebt)

### getMarketCollateral

  ```solidity
  function getMarketCollateral(uint256 marketId) external view returns (uint256)
  ```

gets the snxUSD value of the collateral backing this market.

### getMarketDebtPerShare

  ```solidity
  function getMarketDebtPerShare(uint256 marketId) external returns (int256)
  ```

### MarketRegistered

  ```solidity
  event MarketRegistered(address market, uint256 marketId)
  ```

### UsdDeposited

  ```solidity
  event UsdDeposited(uint256 marketId, address target, uint256 amount, address sender)
  ```

### UsdWithdrawn

  ```solidity
  event UsdWithdrawn(uint256 marketId, address target, uint256 amount, address sender)
  ```

### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint256)
  ```

registers a new market

### depositUsd

  ```solidity
  function depositUsd(uint256 marketId, address target, uint256 amount) external
  ```

target deposits amount of synths to the marketId

### withdrawUsd

  ```solidity
  function withdrawUsd(uint256 marketId, address target, uint256 amount) external
  ```

target withdraws amount of synths to the marketId

### getWithdrawableUsd

  ```solidity
  function getWithdrawableUsd(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### getMarketIssuance

  ```solidity
  function getMarketIssuance(uint256 marketId) external view returns (int128)
  ```

gets net snxUSD withdrawn - deposited by the market

### getMarketReportedDebt

  ```solidity
  function getMarketReportedDebt(uint256 marketId) external view returns (uint256)
  ```

gets the total balance of the market

### getMarketTotalBalance

  ```solidity
  function getMarketTotalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market (marketIssuance + marketReportedDebt)

### getMarketCollateral

  ```solidity
  function getMarketCollateral(uint256 marketId) external view returns (uint256)
  ```

gets the snxUSD value of the collateral backing this market.

### getMarketDebtPerShare

  ```solidity
  function getMarketDebtPerShare(uint256 marketId) external returns (int256)
  ```

