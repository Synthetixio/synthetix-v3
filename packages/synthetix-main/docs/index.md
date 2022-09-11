# Solidity API

## Account Module

### AccountCreated

```solidity
event AccountCreated(address sender, uint256 accountId)
```

Emitted when an account token with id `accountId` is minted to `sender`.

### PermissionGranted

```solidity
event PermissionGranted(uint256 accountId, bytes32 permission, address target, address sender)
```

Emitted when `target` is granted `permission` by `sender` for account `accountId`.

### PermissionRevoked

```solidity
event PermissionRevoked(uint256 accountId, bytes32 permission, address target, address sender)
```

Emitted when `target` has `permission` renounced or revoked by `sender` for account `accountId`.

### AccountPermissions

```solidity
struct AccountPermissions {
  address target;
  bytes32[] permissions;
}

```

### getAccountPermissions

```solidity
function getAccountPermissions(uint256 accountId) external view returns (struct IAccountModule.AccountPermissions[])
```

Returns an array of `AccountPermission` for the provided `accountId`.

### createAccount

```solidity
function createAccount(uint256 requestedAccountId) external
```

Mints an account token with id `requestedAccountId` to `msg.sender`.

Requirements:

- `requestedAccountId` must not already be minted.

Emits a {AccountCreated} event.

### notifyAccountTransfer

```solidity
function notifyAccountTransfer(address to, uint256 accountId) external
```

Grants `permission` to `target` for account `accountId`.

Requirements:

- `msg.sender` must be the account token.

### grantPermission

```solidity
function grantPermission(uint256 accountId, bytes32 permission, address target) external
```

Grants `permission` to `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.

Emits a {PermissionGranted} event.

### revokePermission

```solidity
function revokePermission(uint256 accountId, bytes32 permission, address target) external
```

Revokes `permission` from `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.

Emits a {PermissionRevoked} event.

### renouncePermission

```solidity
function renouncePermission(uint256 accountId, bytes32 permission) external
```

Revokes `permission` from `msg.sender` for account `accountId`.

Emits a {PermissionRevoked} event.

### hasPermission

```solidity
function hasPermission(uint256 accountId, bytes32 permission, address target) external view returns (bool)
```

Returns `true` if `target` has been granted `permission` for account `accountId`.

### getAccountTokenAddress

```solidity
function getAccountTokenAddress() external view returns (address)
```

Returns the address for the account token used by the module.

### getAccountOwner

```solidity
function getAccountOwner(uint256 accountId) external view returns (address)
```

Returns the address that owns a given account, as recorded by the system.

### AccountCreated

```solidity
event AccountCreated(address sender, uint256 accountId)
```

Emitted when an account token with id `accountId` is minted to `sender`.

### PermissionGranted

```solidity
event PermissionGranted(uint256 accountId, bytes32 permission, address target, address sender)
```

Emitted when `target` is granted `permission` by `sender` for account `accountId`.

### PermissionRevoked

```solidity
event PermissionRevoked(uint256 accountId, bytes32 permission, address target, address sender)
```

Emitted when `target` has `permission` renounced or revoked by `sender` for account `accountId`.

### AccountPermissions

```solidity
struct AccountPermissions {
  address target;
  bytes32[] permissions;
}

```

### getAccountPermissions

```solidity
function getAccountPermissions(uint256 accountId) external view returns (struct IAccountModule.AccountPermissions[])
```

Returns an array of `AccountPermission` for the provided `accountId`.

### createAccount

```solidity
function createAccount(uint256 requestedAccountId) external
```

Mints an account token with id `requestedAccountId` to `msg.sender`.

Requirements:

- `requestedAccountId` must not already be minted.

Emits a {AccountCreated} event.

### notifyAccountTransfer

```solidity
function notifyAccountTransfer(address to, uint256 accountId) external
```

Grants `permission` to `target` for account `accountId`.

Requirements:

- `msg.sender` must be the account token.

### grantPermission

```solidity
function grantPermission(uint256 accountId, bytes32 permission, address target) external
```

Grants `permission` to `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.

Emits a {PermissionGranted} event.

### revokePermission

```solidity
function revokePermission(uint256 accountId, bytes32 permission, address target) external
```

Revokes `permission` from `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.

Emits a {PermissionRevoked} event.

### renouncePermission

```solidity
function renouncePermission(uint256 accountId, bytes32 permission) external
```

Revokes `permission` from `msg.sender` for account `accountId`.

Emits a {PermissionRevoked} event.

### hasPermission

```solidity
function hasPermission(uint256 accountId, bytes32 permission, address target) external view returns (bool)
```

Returns `true` if `target` has been granted `permission` for account `accountId`.

### getAccountTokenAddress

```solidity
function getAccountTokenAddress() external view returns (address)
```

Returns the address for the account token used by the module.

### getAccountOwner

```solidity
function getAccountOwner(uint256 accountId) external view returns (address)
```

Returns the address that owns a given account, as recorded by the system.

## Account Token Module

### Mint

```solidity
event Mint(address owner, uint256 tokenId)
```

_Emitted when `tokenId` token is minted._

### mint

```solidity
function mint(address owner, uint256 requestedAccountId) external
```

\_Mints a new token with the `requestedAccountId` as the ID, owned by `owner`

This function is only used internally by the system. See `createAccount` in the Account Module.

Requirements:

- `msg.sender` must be the owner of the contract.
- `requestedAccountId` must not already be minted.

Emits a {Mint} event.\_

### Mint

```solidity
event Mint(address owner, uint256 tokenId)
```

_Emitted when `tokenId` token is minted._

### mint

```solidity
function mint(address owner, uint256 requestedAccountId) external
```

\_Mints a new token with the `requestedAccountId` as the ID, owned by `owner`

This function is only used internally by the system. See `createAccount` in the Account Module.

Requirements:

- `msg.sender` must be the owner of the contract.
- `requestedAccountId` must not already be minted.

Emits a {Mint} event.\_

### isInitialized

```solidity
function isInitialized() external returns (bool)
```

Returns if `initialize` has been called by the owner

### initialize

```solidity
function initialize(string tokenName, string tokenSymbol, string uri) external
```

Allows owner to initialize the token after attaching a proxy

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

_Returns the total amount of tokens stored by the contract._

### tokenOfOwnerByIndex

```solidity
function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)
```

_Returns a token ID owned by `owner` at a given `index` of its token list.
Use along with {balanceOf} to enumerate all of `owner`'s tokens._

### tokenByIndex

```solidity
function tokenByIndex(uint256 index) external view returns (uint256)
```

_Returns a token ID at a given `index` of all the tokens stored by the contract.
Use along with {totalSupply} to enumerate all tokens._

### Transfer

```solidity
event Transfer(address from, address to, uint256 tokenId)
```

_Emitted when `tokenId` token is transferred from `from` to `to`._

### Approval

```solidity
event Approval(address owner, address approved, uint256 tokenId)
```

_Emitted when `owner` enables `approved` to manage the `tokenId` token._

### ApprovalForAll

```solidity
event ApprovalForAll(address owner, address operator, bool approved)
```

_Emitted when `owner` enables or disables (`approved`) `operator` to manage all of its assets._

### balanceOf

```solidity
function balanceOf(address owner) external view returns (uint256 balance)
```

_Returns the number of tokens in `owner`'s account._

### ownerOf

```solidity
function ownerOf(uint256 tokenId) external view returns (address owner)
```

\_Returns the owner of the `tokenId` token.

Requirements:

- `tokenId` must exist.\_

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external
```

\_Safely transfers `tokenId` token from `from` to `to`.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event.\_

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId) external
```

\_Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
are aware of the ERC721 protocol to prevent tokens from being forever locked.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must have been allowed to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event.\_

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 tokenId) external
```

\_Transfers `tokenId` token from `from` to `to`.

WARNING: Usage of this method is discouraged, use {safeTransferFrom} whenever possible.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.

Emits a {Transfer} event.\_

### approve

```solidity
function approve(address to, uint256 tokenId) external
```

\_Gives permission to `to` to transfer `tokenId` token to another account.
The approval is cleared when the token is transferred.

Only a single account can be approved at a time, so approving the zero address clears previous approvals.

Requirements:

- The caller must own the token or be an approved operator.
- `tokenId` must exist.

Emits an {Approval} event.\_

### setApprovalForAll

```solidity
function setApprovalForAll(address operator, bool approved) external
```

\_Approve or remove `operator` as an operator for the caller.
Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.

Requirements:

- The `operator` cannot be the caller.

Emits an {ApprovalForAll} event.\_

### getApproved

```solidity
function getApproved(uint256 tokenId) external view returns (address operator)
```

\_Returns the account approved for `tokenId` token.

Requirements:

- `tokenId` must exist.\_

### isApprovedForAll

```solidity
function isApprovedForAll(address owner, address operator) external view returns (bool)
```

\_Returns if the `operator` is allowed to manage all of the assets of `owner`.

See {setApprovalForAll}\_

## Collateral Module

### CollateralConfigured

```solidity
event CollateralConfigured(address collateralType, address priceFeed, uint256 targetCollateralizationRatio, uint256 minimumCollateralizationRatio, uint256 liquidationReward, bool enabled)
```

Emitted when a collateral type’s configuration is created or updated.

### CollateralDeposited

```solidity
event CollateralDeposited(uint256 accountId, address collateralType, uint256 amount, address sender)
```

Emitted when `amount` of collateral of type `collateralType` is deposited to account `accountId` by `sender`.

### CollateralWithdrawn

```solidity
event CollateralWithdrawn(uint256 accountId, address collateralType, uint256 amount, address sender)
```

Emitted when `amount` of collateral of type `collateralType` is withdrawn from account `accountId` by `sender`.

### configureCollateral

```solidity
function configureCollateral(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, uint256 liquidationReward, bool enabled) external
```

Creates or updates the configuration for given `collateralType`.

Requirements:

- `msg.sender` must be the owner of the system.

Emits a {CollateralConfigured} event.

### getCollateralConfigurations

```solidity
function getCollateralConfigurations(bool hideDisabled) external view returns (struct CollateralStorage.CollateralConfiguration[] collaterals)
```

Returns a list of detailed information pertaining to all collateral types registered in the system.

### getCollateralConfiguration

```solidity
function getCollateralConfiguration(address collateralType) external view returns (struct CollateralStorage.CollateralConfiguration collateral)
```

Returns detailed information pertaining the specified collateral type.

### depositCollateral

```solidity
function depositCollateral(uint256 accountId, address collateralType, uint256 amount) external
```

Deposits `amount` of collateral of type `collateralType` into account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DEPOSIT` permission.

Emits a {CollateralDeposited} event.

### withdrawCollateral

```solidity
function withdrawCollateral(uint256 accountId, address collateralType, uint256 amount) external
```

Withdraws `amount` of collateral of type `collateralType` from account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `WITHDRAW` permission.

Emits a {CollateralWithdrawn} event.

### getAccountCollateral

```solidity
function getAccountCollateral(uint256 accountId, address collateralType) external view returns (uint256 totalDeposited, uint256 totalAssigned)
```

Returns the total values pertaining to account `accountId` for `collateralType`.

### getAccountAvailableCollateral

```solidity
function getAccountAvailableCollateral(uint256 accountId, address collateralType) external view returns (uint256)
```

Returns the amount of collateral of type `collateralType` deposited with account `accountId` that can be withdrawn or delegated.

### CollateralConfigured

```solidity
event CollateralConfigured(address collateralType, address priceFeed, uint256 targetCollateralizationRatio, uint256 minimumCollateralizationRatio, uint256 liquidationReward, bool enabled)
```

Emitted when a collateral type’s configuration is created or updated.

### CollateralDeposited

```solidity
event CollateralDeposited(uint256 accountId, address collateralType, uint256 amount, address sender)
```

Emitted when `amount` of collateral of type `collateralType` is deposited to account `accountId` by `sender`.

### CollateralWithdrawn

```solidity
event CollateralWithdrawn(uint256 accountId, address collateralType, uint256 amount, address sender)
```

Emitted when `amount` of collateral of type `collateralType` is withdrawn from account `accountId` by `sender`.

### configureCollateral

```solidity
function configureCollateral(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, uint256 liquidationReward, bool enabled) external
```

Creates or updates the configuration for given `collateralType`.

Requirements:

- `msg.sender` must be the owner of the system.

Emits a {CollateralConfigured} event.

### getCollateralConfigurations

```solidity
function getCollateralConfigurations(bool hideDisabled) external view returns (struct CollateralStorage.CollateralConfiguration[] collaterals)
```

Returns a list of detailed information pertaining to all collateral types registered in the system.

### getCollateralConfiguration

```solidity
function getCollateralConfiguration(address collateralType) external view returns (struct CollateralStorage.CollateralConfiguration collateral)
```

Returns detailed information pertaining the specified collateral type.

### depositCollateral

```solidity
function depositCollateral(uint256 accountId, address collateralType, uint256 amount) external
```

Deposits `amount` of collateral of type `collateralType` into account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DEPOSIT` permission.

Emits a {CollateralDeposited} event.

### withdrawCollateral

```solidity
function withdrawCollateral(uint256 accountId, address collateralType, uint256 amount) external
```

Withdraws `amount` of collateral of type `collateralType` from account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `WITHDRAW` permission.

Emits a {CollateralWithdrawn} event.

### getAccountCollateral

```solidity
function getAccountCollateral(uint256 accountId, address collateralType) external view returns (uint256 totalDeposited, uint256 totalAssigned)
```

Returns the total values pertaining to account `accountId` for `collateralType`.

### getAccountAvailableCollateral

```solidity
function getAccountAvailableCollateral(uint256 accountId, address collateralType) external view returns (uint256)
```

Returns the amount of collateral of type `collateralType` deposited with account `accountId` that can be withdrawn or delegated.

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

## Multicall Module

### multicall

```solidity
function multicall(bytes[] data) external payable returns (bytes[] results)
```

### multicall

```solidity
function multicall(bytes[] data) external payable returns (bytes[] results)
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

## Reward Distributor Module

### setRewardAllocation

```solidity
function setRewardAllocation(uint256 poolId, uint256 allocation) external
```

### getRewardAllocation

```solidity
function getRewardAllocation(uint256 poolId) external view returns (uint256)
```

### setRewardAllocation

```solidity
function setRewardAllocation(uint256 poolId, uint256 allocation) external
```

### getRewardAllocation

```solidity
function getRewardAllocation(uint256 poolId) external view returns (uint256)
```

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

## Vault Rewards Module

### RewardDistributionSet

```solidity
event RewardDistributionSet(uint256 poolId, address token, uint256 index, address distributor, uint256 totalRewarded, uint256 start, uint256 duration)
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

### getAvailableRewards

```solidity
function getAvailableRewards(uint256 poolId, address token, uint256 accountId) external returns (uint256[])
```

retrieves the amount of available rewards.
this function should be called to get currently available rewards using `callStatic`

### claimRewards

```solidity
function claimRewards(uint256 poolId, address token, uint256 accountId) external returns (uint256[])
```

retrieves the amount of available rewards, and claims them to the caller's account.
this function should be called to get currently available rewards using `callStatic`

### getCurrentRewardAccumulation

```solidity
function getCurrentRewardAccumulation(uint256 poolId, address collateralType) external view returns (uint256[])
```

returns the number of individual units of amount emitted per second per share for the given poolId, collateralType vault

### RewardDistributionSet

```solidity
event RewardDistributionSet(uint256 poolId, address token, uint256 index, address distributor, uint256 totalRewarded, uint256 start, uint256 duration)
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

### getAvailableRewards

```solidity
function getAvailableRewards(uint256 poolId, address token, uint256 accountId) external returns (uint256[])
```

retrieves the amount of available rewards.
this function should be called to get currently available rewards using `callStatic`

### claimRewards

```solidity
function claimRewards(uint256 poolId, address token, uint256 accountId) external returns (uint256[])
```

retrieves the amount of available rewards, and claims them to the caller's account.
this function should be called to get currently available rewards using `callStatic`

### getCurrentRewardAccumulation

```solidity
function getCurrentRewardAccumulation(uint256 poolId, address collateralType) external view returns (uint256[])
```

returns the number of individual units of amount emitted per second per share for the given poolId, collateralType vault
