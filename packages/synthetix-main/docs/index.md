# Solidity API

## Account Module

### Functions

#### getAccountPermissions

  ```solidity
  function getAccountPermissions(uint128 accountId) external view returns (struct IAccountModule.AccountPermissions[])
  ```

  Returns an array of `AccountPermission` for the provided `accountId`.

#### createAccount

  ```solidity
  function createAccount(uint128 requestedAccountId) external
  ```

  Mints an account token with id `requestedAccountId` to `msg.sender`.

Requirements:

- `requestedAccountId` must not already be minted.

Emits a {AccountCreated} event.

#### notifyAccountTransfer

  ```solidity
  function notifyAccountTransfer(address to, uint128 accountId) external
  ```

  Grants `permission` to `user` for account `accountId`.

Requirements:

- `msg.sender` must be the account token.

#### grantPermission

  ```solidity
  function grantPermission(uint128 accountId, bytes32 permission, address user) external
  ```

  Grants `permission` to `user` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.

Emits a {PermissionGranted} event.

#### revokePermission

  ```solidity
  function revokePermission(uint128 accountId, bytes32 permission, address user) external
  ```

  Revokes `permission` from `user` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.

Emits a {PermissionRevoked} event.

#### renouncePermission

  ```solidity
  function renouncePermission(uint128 accountId, bytes32 permission) external
  ```

  Revokes `permission` from `msg.sender` for account `accountId`.

Emits a {PermissionRevoked} event.

#### hasPermission

  ```solidity
  function hasPermission(uint128 accountId, bytes32 permission, address user) external view returns (bool)
  ```

  Returns `true` if `user` has been granted `permission` for account `accountId`.

#### isAuthorized

  ```solidity
  function isAuthorized(uint128 accountId, bytes32 permission, address target) external view returns (bool)
  ```

  Returns `true` if `target` is authorized to `permission` for account `accountId`.

#### getAccountTokenAddress

  ```solidity
  function getAccountTokenAddress() external view returns (address)
  ```

  Returns the address for the account token used by the module.

#### getAccountOwner

  ```solidity
  function getAccountOwner(uint128 accountId) external view returns (address)
  ```

  Returns the address that owns a given account, as recorded by the system.

### Events

#### AccountCreated

  ```solidity
  event AccountCreated(address sender, uint128 accountId)
  ```

  Emitted when an account token with id `accountId` is minted to `sender`.

#### PermissionGranted

  ```solidity
  event PermissionGranted(uint128 accountId, bytes32 permission, address user, address sender)
  ```

  Emitted when `user` is granted `permission` by `sender` for account `accountId`.

#### PermissionRevoked

  ```solidity
  event PermissionRevoked(uint128 accountId, bytes32 permission, address user, address sender)
  ```

  Emitted when `user` has `permission` renounced or revoked by `sender` for account `accountId`.

## Account Token Module

### Functions

#### mint

  ```solidity
  function mint(address owner, uint256 requestedAccountId) external
  ```

  Mints a new token with the `requestedAccountId` as the ID, owned by `owner`

This function is only used internally by the system. See `createAccount` in the Account Module.

Requirements:

- `msg.sender` must be the owner of the contract.
- `requestedAccountId` must not already be minted.

Emits a {Mint} event.

#### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns if `initialize` has been called by the owner

#### initialize

  ```solidity
  function initialize(string tokenName, string tokenSymbol, string uri) external
  ```

  Allows owner to initialize the token after attaching a proxy

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

#### tokenByIndex

  ```solidity
  function tokenByIndex(uint256 index) external view returns (uint256)
  ```

  Returns a token ID at a given `index` of all the tokens stored by the contract.
Use along with {totalSupply} to enumerate all tokens.

#### balanceOf

  ```solidity
  function balanceOf(address owner) external view returns (uint256 balance)
  ```

  Returns the number of tokens in ``owner``'s account.

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

#### Mint

  ```solidity
  event Mint(address owner, uint256 tokenId)
  ```

  Emitted when `tokenId` token is minted.

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
  function associateDebt(uint128 marketId, uint128 poolId, address collateralType, uint128 accountId, uint256 amount) external returns (int256)
  ```

  Allows for a market, at its discression to allocate the assignment of recently accumulated debt in a
market toward an individual

### Events

## Collateral Module

### Functions

#### configureCollateral

  ```solidity
  function configureCollateral(struct CollateralConfiguration.Data config) external
  ```

  Creates or updates the configuration for given `collateralType`.

Requirements:

- `msg.sender` must be the owner of the system.

Emits a {CollateralConfigured} event.

#### getCollateralConfigurations

  ```solidity
  function getCollateralConfigurations(bool hideDisabled) external view returns (struct CollateralConfiguration.Data[] collaterals)
  ```

  Returns a list of detailed information pertaining to all collateral types registered in the system.

#### getCollateralConfiguration

  ```solidity
  function getCollateralConfiguration(address collateralType) external view returns (struct CollateralConfiguration.Data collateral)
  ```

  Returns detailed information pertaining the specified collateral type.

#### getCollateralPrice

  ```solidity
  function getCollateralPrice(address collateralType) external view returns (uint256)
  ```

  Returns the current value of a specified collateral type

#### deposit

  ```solidity
  function deposit(uint128 accountId, address collateralType, uint256 amount) external
  ```

  Deposits `amount` of collateral of type `collateralType` into account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DEPOSIT` permission.

Emits a {CollateralDeposited} event.

#### withdraw

  ```solidity
  function withdraw(uint128 accountId, address collateralType, uint256 amount) external
  ```

  Withdraws `amount` of collateral of type `collateralType` from account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `WITHDRAW` permission.

Emits a {CollateralWithdrawn} event.

#### getAccountCollateral

  ```solidity
  function getAccountCollateral(uint128 accountId, address collateralType) external view returns (uint256 totalDeposited, uint256 totalAssigned, uint256 totalLocked)
  ```

  Returns the total values pertaining to account `accountId` for `collateralType`.

#### getAccountAvailableCollateral

  ```solidity
  function getAccountAvailableCollateral(uint128 accountId, address collateralType) external view returns (uint256)
  ```

  Returns the amount of collateral of type `collateralType` deposited with account `accountId` that can be withdrawn or delegated.

#### cleanExpiredLocks

  ```solidity
  function cleanExpiredLocks(uint128 accountId, address collateralType, uint256 offset, uint256 items) external
  ```

  Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)

  DEPENDENT ON 305

#### createLock

  ```solidity
  function createLock(uint128 accountId, address collateralType, uint256 amount, uint64 expireTimestamp) external
  ```

  Create a new lock on the given account. you must have `admin` permission on the specified account to create a lock.
There is currently no benefit to calling this function. it is simply for allowing pre-created accounts to have locks on them if your protocol requires it.

### Events

#### CollateralConfigured

  ```solidity
  event CollateralConfigured(address collateralType, struct CollateralConfiguration.Data config)
  ```

  Emitted when a collateral type’s configuration is created or updated.

#### Deposited

  ```solidity
  event Deposited(uint128 accountId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when `amount` of collateral of type `collateralType` is deposited to account `accountId` by `sender`.

#### Withdrawn

  ```solidity
  event Withdrawn(uint128 accountId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when `amount` of collateral of type `collateralType` is withdrawn from account `accountId` by `sender`.

## IssueUSD Module

### Functions

#### mintUsd

  ```solidity
  function mintUsd(uint128 accountId, uint128 poolId, address collateralType, uint256 amount) external
  ```

  Mints {amount} of snxUSD with the specified staking position.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `MINT` permission.
- After minting, the collateralization ratio of the staking position must not be below the target collateralization ratio for the corresponding collateral type.

Emits a {UsdMinted} event.

#### burnUsd

  ```solidity
  function burnUsd(uint128 accountId, uint128 poolId, address collateralType, uint256 amount) external
  ```

  Burns {amount} of snxUSD with the specified staking position.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `BURN` permission.

Emits a {UsdMinted} event.

### Events

#### UsdMinted

  ```solidity
  event UsdMinted(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when {sender} mints {amount} of snxUSD with the specified staking position.

#### UsdBurned

  ```solidity
  event UsdBurned(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when {sender} burns {amount} of snxUSD with the specified staking position.

## Liquidation Module

### Functions

#### liquidate

  ```solidity
  function liquidate(uint128 accountId, uint128 poolId, address collateralType) external returns (uint256 amountRewarded, uint256 debtLiquidated, uint256 collateralLiquidated)
  ```

  liquidates the required collateral of the account delegated to the poolId

#### liquidateVault

  ```solidity
  function liquidateVault(uint128 poolId, address collateralType, uint128 liquidateAsAccountId, uint256 maxUsd) external returns (uint256 amountRewarded, uint256 collateralLiquidated)
  ```

  liquidates an entire vault. can only be done if the vault itself is undercollateralized.
liquidateAsAccountId determines which account to deposit the siezed collateral into (this is necessary particularly if the collateral in the vault is vesting)
Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied

#### isLiquidatable

  ```solidity
  function isLiquidatable(uint128 accountId, uint128 poolId, address collateralType) external returns (bool)
  ```

  returns if the account is liquidable on the poolId - collateralType pair

### Events

#### Liquidation

  ```solidity
  event Liquidation(uint128 accountId, uint128 poolId, address collateralType, uint256 debtLiquidated, uint256 collateralLiquidated, uint256 amountRewarded)
  ```

#### VaultLiquidation

  ```solidity
  event VaultLiquidation(uint128 poolId, address collateralType, uint256 debtLiquidated, uint256 collateralLiquidated, uint256 amountRewarded)
  ```

## Market Collateral Module

### Functions

#### depositMarketCollateral

  ```solidity
  function depositMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

#### withdrawMarketCollateral

  ```solidity
  function withdrawMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

#### configureMaximumMarketCollateral

  ```solidity
  function configureMaximumMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

#### getMaximumMarketCollateral

  ```solidity
  function getMaximumMarketCollateral(uint128 marketId, address collateralType) external returns (uint256)
  ```

#### getMarketCollateralAmount

  ```solidity
  function getMarketCollateralAmount(uint128 marketId, address collateralType) external returns (uint256)
  ```

### Events

#### MarketCollateralDeposited

  ```solidity
  event MarketCollateralDeposited(uint128 marketId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when `amount` of collateral of type `collateralType` is deposited to market `marketId` by `sender`.

#### MarketCollateralWithdrawn

  ```solidity
  event MarketCollateralWithdrawn(uint128 marketId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when `amount` of collateral of type `collateralType` is withdrawn from market `marketId` by `sender`.

#### MaximumMarketCollateralConfigured

  ```solidity
  event MaximumMarketCollateralConfigured(uint128 marketId, address collateralType, uint256 amount, address sender)
  ```

## Market Manager Module

### Functions

#### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint128)
  ```

  registers a new market

#### depositMarketUsd

  ```solidity
  function depositMarketUsd(uint128 marketId, address target, uint256 amount) external
  ```

  target deposits amount of synths to the marketId

#### withdrawMarketUsd

  ```solidity
  function withdrawMarketUsd(uint128 marketId, address target, uint256 amount) external
  ```

  target withdraws amount of synths to the marketId

#### getWithdrawableUsd

  ```solidity
  function getWithdrawableUsd(uint128 marketId) external view returns (uint256)
  ```

  gets the liquidity of the market

#### getMarketIssuance

  ```solidity
  function getMarketNetIssuance(uint128 marketId) external view returns (int128)
  ```

  gets net snxUSD withdrawn - deposited by the market

#### getMarketReportedDebt

  ```solidity
  function getMarketReportedDebt(uint128 marketId) external view returns (uint256)
  ```

  gets the total balance of the market

#### getMarketTotalBalance

  ```solidity
  function getMarketTotalBalance(uint128 marketId) external view returns (int256)
  ```

  gets the total balance of the market (marketIssuance + marketReportedDebt)

#### getMarketCollateral

  ```solidity
  function getMarketCollateral(uint128 marketId) external view returns (uint256)
  ```

  gets the snxUSD value of the collateral backing this market.

#### getMarketDebtPerShare

  ```solidity
  function getMarketDebtPerShare(uint128 marketId) external returns (int256)
  ```

#### isMarketCapacityLocked

  ```solidity
  function isMarketCapacityLocked(uint128 marketId) external view returns (bool)
  ```

### Events

#### MarketRegistered

  ```solidity
  event MarketRegistered(address market, uint128 marketId)
  ```

#### MarketUsdDeposited

  ```solidity
  event MarketUsdDeposited(uint128 marketId, address target, uint256 amount, address sender)
  ```

#### MarketUsdWithdrawn

  ```solidity
  event MarketUsdWithdrawn(uint128 marketId, address target, uint256 amount, address sender)
  ```

## Multicall Module

### Functions

#### multicall

  ```solidity
  function multicall(bytes[] data) external payable returns (bytes[] results)
  ```

### Events

## Pool Configuration Module

### Functions

#### setPreferredPool

  ```solidity
  function setPreferredPool(uint128 poolId) external
  ```

  SCCP sets the preferred pool

#### addApprovedPool

  ```solidity
  function addApprovedPool(uint128 poolId) external
  ```

  SCCP adds a poolId to the approved list

#### removeApprovedPool

  ```solidity
  function removeApprovedPool(uint128 poolId) external
  ```

  SCCP removes a poolId to the approved list

#### getPreferredPool

  ```solidity
  function getPreferredPool() external view returns (uint256)
  ```

  gets the preferred pool

#### getApprovedPools

  ```solidity
  function getApprovedPools() external view returns (uint256[])
  ```

  gets the approved pools (list of poolIds)

### Events

#### PreferredPoolSet

  ```solidity
  event PreferredPoolSet(uint256 poolId)
  ```

#### PoolApprovedAdded

  ```solidity
  event PoolApprovedAdded(uint256 poolId)
  ```

#### PoolApprovedRemoved

  ```solidity
  event PoolApprovedRemoved(uint256 poolId)
  ```

## Pool Module

### Functions

#### createPool

  ```solidity
  function createPool(uint128 requestedPoolId, address owner) external
  ```

  creates a new pool

#### setPoolConfiguration

  ```solidity
  function setPoolConfiguration(uint128 poolId, struct MarketConfiguration.Data[] marketDistribution) external
  ```

  sets the pool positions (only poolToken owner)

#### getPoolConfiguration

  ```solidity
  function getPoolConfiguration(uint128 poolId) external view returns (struct MarketConfiguration.Data[] markets)
  ```

  gets the pool positions

#### setPoolName

  ```solidity
  function setPoolName(uint128 poolId, string name) external
  ```

  sets the pool name

#### getPoolName

  ```solidity
  function getPoolName(uint128 poolId) external view returns (string poolName)
  ```

  gets the pool name

#### nominatePoolOwner

  ```solidity
  function nominatePoolOwner(address nominatedOwner, uint128 poolId) external
  ```

  nominates a new pool owner

#### acceptPoolOwnership

  ```solidity
  function acceptPoolOwnership(uint128 poolId) external
  ```

  accepts ownership by nominated owner

#### revokePoolNomination

  ```solidity
  function revokePoolNomination(uint128 poolId) external
  ```

  revokes nomination by pool owner

#### renouncePoolNomination

  ```solidity
  function renouncePoolNomination(uint128 poolId) external
  ```

  renounce nomination by nominee

#### getPoolOwner

  ```solidity
  function getPoolOwner(uint128 poolId) external view returns (address)
  ```

  gets owner of poolId

#### getNominatedPoolOwner

  ```solidity
  function getNominatedPoolOwner(uint128 poolId) external view returns (address)
  ```

  gets nominatedOwner of poolId

#### setMinLiquidityRatio

  ```solidity
  function setMinLiquidityRatio(uint256 minLiquidityRatio) external
  ```

  places a cap on what proportion of free vault liquidity may be used towards a pool. only owner.

#### getMinLiquidityRatio

  ```solidity
  function getMinLiquidityRatio() external view returns (uint256)
  ```

  returns the liquidity ratio cap for delegation of liquidity by pools to markets

### Events

#### PoolCreated

  ```solidity
  event PoolCreated(uint128 poolId, address owner)
  ```

  gets fired when pool will be created

#### NominatedPoolOwner

  ```solidity
  event NominatedPoolOwner(uint128 poolId, address owner)
  ```

  gets fired when pool owner proposes a new owner

#### PoolOwnershipAccepted

  ```solidity
  event PoolOwnershipAccepted(uint128 poolId, address owner)
  ```

  gets fired when pool nominee accepts nomination

#### PoolNominationRevoked

  ```solidity
  event PoolNominationRevoked(uint128 poolId, address owner)
  ```

  gets fired when pool owner revokes nonimation

#### PoolNominationRenounced

  ```solidity
  event PoolNominationRenounced(uint128 poolId, address owner)
  ```

  gets fired when pool nominee renounces nomination

#### PoolNameUpdated

  ```solidity
  event PoolNameUpdated(uint128 poolId, string name, address sender)
  ```

  gets fired when pool name changes

#### PoolConfigurationSet

  ```solidity
  event PoolConfigurationSet(uint128 poolId, struct MarketConfiguration.Data[] markets, address sender)
  ```

  gets fired when pool gets configured

## Reward Distributor Module

### Functions

#### name

  ```solidity
  function name() external view returns (string)
  ```

  returns a human-readable name for a this rewards distributor

#### setRewardAllocation

  ```solidity
  function setRewardAllocation(uint128 poolId, uint256 allocation) external
  ```

#### getRewardAllocation

  ```solidity
  function getRewardAllocation(uint128 poolId) external view returns (uint256)
  ```

### Events

## Rewards Manager Module

### Functions

#### registerRewardsDistributor

  ```solidity
  function registerRewardsDistributor(uint128 poolId, address collateralType, address distributor) external
  ```

  called by pool owner or an existing distributor to register rewards for vault participants

#### distributeRewards

  ```solidity
  function distributeRewards(uint128 poolId, address collateralType, uint256 amount, uint256 start, uint256 duration) external
  ```

  called by pool owner or an existing distributor to set up rewards for vault participants

#### claimRewards

  ```solidity
  function claimRewards(uint128 poolId, address collateralType, uint128 accountId, address distributor) external returns (uint256)
  ```

  retrieves the amount of available reward, and claims them to the caller's account for a given distributor.

#### getRewards

  ```solidity
  function getRewards(uint128 poolId, address collateralType, uint128 accountId) external returns (uint256[], address[])
  ```

  retrieves the amount of available rewards.

  this function should be called to get currently available rewards using `callStatic`

#### getRewardRate

  ```solidity
  function getRewardRate(uint128 poolId, address collateralType, address distributor) external view returns (uint256)
  ```

  returns the number of individual units of amount emitted per second per share for the given poolId, collateralType, distributor vault

### Events

#### RewardsDistributed

  ```solidity
  event RewardsDistributed(uint128 poolId, address collateralType, address distributor, uint256 amount, uint256 start, uint256 duration)
  ```

#### RewardsClaimed

  ```solidity
  event RewardsClaimed(uint128 accountId, uint128 poolId, address collateralType, address distributor, uint256 amount)
  ```

## USD Token Module

### Functions

#### burnWithAllowance

  ```solidity
  function burnWithAllowance(address from, address spender, uint256 amount) external
  ```

#### transferCrossChain

  ```solidity
  function transferCrossChain(uint256 destChainId, address, uint256 amount) external returns (uint256 feesPaid)
  ```

#### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  returns if `initialize` has been called by the owner

#### initialize

  ```solidity
  function initialize(string tokenName, string tokenSymbol, uint8 tokenDecimals) external
  ```

  allows owner to initialize the token after attaching a proxy

#### mint

  ```solidity
  function mint(address to, uint256 amount) external
  ```

  mints token amount to "to" address

#### burn

  ```solidity
  function burn(address to, uint256 amount) external
  ```

  burns token amount from "to" address

#### setAllowance

  ```solidity
  function setAllowance(address from, address spender, uint256 amount) external
  ```

  sets token amount allowance to spender by "from" address

#### name

  ```solidity
  function name() external view returns (string)
  ```

#### symbol

  ```solidity
  function symbol() external view returns (string)
  ```

#### decimals

  ```solidity
  function decimals() external view returns (uint8)
  ```

#### totalSupply

  ```solidity
  function totalSupply() external view returns (uint256)
  ```

#### balanceOf

  ```solidity
  function balanceOf(address owner) external view returns (uint256)
  ```

#### allowance

  ```solidity
  function allowance(address owner, address spender) external view returns (uint256)
  ```

#### transfer

  ```solidity
  function transfer(address to, uint256 amount) external returns (bool)
  ```

#### approve

  ```solidity
  function approve(address spender, uint256 amount) external returns (bool)
  ```

#### transferFrom

  ```solidity
  function transferFrom(address from, address to, uint256 amount) external returns (bool)
  ```

### Events

## Vault Module

### Functions

#### delegateCollateral

  ```solidity
  function delegateCollateral(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, uint256 leverage) external
  ```

  Delegates (creates, adjust or remove a delegation) collateral from an account.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DELEGATE` permission.
- If increasing the amount delegated, it must not exceed the available collateral (`getAccountAvailableCollateral`) associated with the account.
- If decreasing the amount delegated, the staking position must have a collateralization ratio greater than the target collateralization ratio for the corresponding collateral type.

Emits a {DelegationUpdated} event.

#### getPositionCollateralizationRatio

  ```solidity
  function getPositionCollateralizationRatio(uint128 accountId, uint128 poolId, address collateralType) external returns (uint256)
  ```

  Returns the collateralization ratio of the specified staking position. If debt is negative, this function will return 0.

  Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places.

#### getPositionDebt

  ```solidity
  function getPositionDebt(uint128 accountId, uint128 poolId, address collateralType) external returns (int256)
  ```

  Returns the debt of the specified staking position. Credit is expressed as negative debt.

  Call this function using `callStatic` to treat it as a view function.
The return value is denominated in dollars with 18 decimal places.

#### getPositionCollateral

  ```solidity
  function getPositionCollateral(uint128 accountId, uint128 poolId, address collateralType) external view returns (uint256 collateralAmount, uint256 collateralValue)
  ```

  Returns the amount and value of the collateral associated with the specified staking position.

  Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType.

#### getPosition

  ```solidity
  function getPosition(uint128 accountId, uint128 poolId, address collateralType) external returns (uint256 collateralAmount, uint256 collateralValue, int256 debt, uint256 collateralizationRatio)
  ```

  Returns all information pertaining to a specified staking position in the vault module.

#### getVaultDebt

  ```solidity
  function getVaultDebt(uint128 poolId, address collateralType) external returns (int256)
  ```

  Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.

  Call this function using `callStatic` to treat it as a view function.
The return value is denominated in dollars with 18 decimal places.

#### getVaultCollateral

  ```solidity
  function getVaultCollateral(uint128 poolId, address collateralType) external returns (uint256 collateralAmount, uint256 collateralValue)
  ```

  Returns the amount and value of the collateral held by the vault.

  Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType.

#### getVaultCollateralRatio

  ```solidity
  function getVaultCollateralRatio(uint128 poolId, address collateralType) external returns (uint256)
  ```

  Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.

  Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places.

### Events

#### DelegationUpdated

  ```solidity
  event DelegationUpdated(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, uint256 leverage, address sender)
  ```

  Emitted when {sender} updates the delegation of collateral in the specified staking position.

