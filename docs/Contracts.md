# Smart Contracts

- [Synthetix Core](#synthetix-core)
- [Spot Market](#spot-market)
- [Perps Market](#perps-market)
- [Governance](#governance)
- [Oracle Manager](#oracle-manager)

## Synthetix Core

### Account Module

#### getAccountPermissions

  ```solidity
  function getAccountPermissions(uint128 accountId) external view returns (struct IAccountModule.AccountPermissions[] accountPerms)
  ```

  Returns an array of `AccountPermission` for the provided `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose permissions are being retrieved.

**Returns**
* `accountPerms` (*struct IAccountModule.AccountPermissions[]*) - An array of AccountPermission objects describing the permissions granted to the account.
#### createAccount

  ```solidity
  function createAccount(uint128 requestedAccountId) external
  ```

  Mints an account token with id `requestedAccountId` to `msg.sender`.

**Parameters**
* `requestedAccountId` (*uint128*) - The id requested for the account being created. Reverts if id already exists. Requirements: - `requestedAccountId` must not already be minted. - `requestedAccountId` must be less than type(uint128).max / 2 Emits a {AccountCreated} event.

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

**Parameters**
* `to` (*address*) - The new holder of the account NFT.
* `accountId` (*uint128*) - The id of the account that was just transferred. Requirements: - `msg.sender` must be the account token.

#### grantPermission

  ```solidity
  function grantPermission(uint128 accountId, bytes32 permission, address user) external
  ```

  Grants `permission` to `user` for account `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account that granted the permission.
* `permission` (*bytes32*) - The bytes32 identifier of the permission.
* `user` (*address*) - The target address that received the permission. Requirements: - `msg.sender` must own the account token with ID `accountId` or have the "admin" permission. Emits a {PermissionGranted} event.

#### revokePermission

  ```solidity
  function revokePermission(uint128 accountId, bytes32 permission, address user) external
  ```

  Revokes `permission` from `user` for account `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account that revoked the permission.
* `permission` (*bytes32*) - The bytes32 identifier of the permission.
* `user` (*address*) - The target address that no longer has the permission. Requirements: - `msg.sender` must own the account token with ID `accountId` or have the "admin" permission. Emits a {PermissionRevoked} event.

#### renouncePermission

  ```solidity
  function renouncePermission(uint128 accountId, bytes32 permission) external
  ```

  Revokes `permission` from `msg.sender` for account `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose permission was renounced.
* `permission` (*bytes32*) - The bytes32 identifier of the permission. Emits a {PermissionRevoked} event.

#### hasPermission

  ```solidity
  function hasPermission(uint128 accountId, bytes32 permission, address user) external view returns (bool hasPermission)
  ```

  Returns `true` if `user` has been granted `permission` for account `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose permission is being queried.
* `permission` (*bytes32*) - The bytes32 identifier of the permission.
* `user` (*address*) - The target address whose permission is being queried.

**Returns**
* `hasPermission` (*bool*) - A boolean with the response of the query.
#### isAuthorized

  ```solidity
  function isAuthorized(uint128 accountId, bytes32 permission, address target) external view returns (bool isAuthorized)
  ```

  Returns `true` if `target` is authorized to `permission` for account `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose permission is being queried.
* `permission` (*bytes32*) - The bytes32 identifier of the permission.
* `target` (*address*) - The target address whose permission is being queried.

**Returns**
* `isAuthorized` (*bool*) - A boolean with the response of the query.
#### getAccountTokenAddress

  ```solidity
  function getAccountTokenAddress() external view returns (address accountNftToken)
  ```

  Returns the address for the account token used by the module.

**Returns**
* `accountNftToken` (*address*) - The address of the account token.
#### getAccountOwner

  ```solidity
  function getAccountOwner(uint128 accountId) external view returns (address owner)
  ```

  Returns the address that owns a given account, as recorded by the system.

**Parameters**
* `accountId` (*uint128*) - The account id whose owner is being retrieved.

**Returns**
* `owner` (*address*) - The owner of the given account id.
#### getAccountLastInteraction

  ```solidity
  function getAccountLastInteraction(uint128 accountId) external view returns (uint256 timestamp)
  ```

  Returns the last unix timestamp that a permissioned action was taken with this account

**Parameters**
* `accountId` (*uint128*) - The account id to check

**Returns**
* `timestamp` (*uint256*) - The unix timestamp of the last time a permissioned action occured with the account

#### AccountCreated

  ```solidity
  event AccountCreated(uint128 accountId, address owner)
  ```

  Emitted when an account token with id `accountId` is minted to `sender`.

**Parameters**
* `accountId` (*uint128*) - The id of the account.
* `owner` (*address*) - The address that owns the created account.

#### PermissionGranted

  ```solidity
  event PermissionGranted(uint128 accountId, bytes32 permission, address user, address sender)
  ```

  Emitted when `user` is granted `permission` by `sender` for account `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account that granted the permission.
* `permission` (*bytes32*) - The bytes32 identifier of the permission.
* `user` (*address*) - The target address to whom the permission was granted.
* `sender` (*address*) - The Address that granted the permission.

#### PermissionRevoked

  ```solidity
  event PermissionRevoked(uint128 accountId, bytes32 permission, address user, address sender)
  ```

  Emitted when `user` has `permission` renounced or revoked by `sender` for account `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account that has had the permission revoked.
* `permission` (*bytes32*) - The bytes32 identifier of the permission.
* `user` (*address*) - The target address for which the permission was revoked.
* `sender` (*address*) - The address that revoked the permission.

### Account Token Module

#### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns whether the token has been initialized.

**Returns**
* `[0]` (*bool*) - A boolean with the result of the query.
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

**Parameters**
* `to` (*address*) - The address to receive the newly minted tokens.
* `tokenId` (*uint256*) - The ID of the newly minted token

#### safeMint

  ```solidity
  function safeMint(address to, uint256 tokenId, bytes data) external
  ```

  Allows the owner to mint tokens. Verifies that the receiver can receive the token

**Parameters**
* `to` (*address*) - The address to receive the newly minted token.
* `tokenId` (*uint256*) - The ID of the newly minted token
* `data` (*bytes*) - any data which should be sent to the receiver

#### burn

  ```solidity
  function burn(uint256 tokenId) external
  ```

  Allows the owner to burn tokens.

**Parameters**
* `tokenId` (*uint256*) - The token to burn

#### setAllowance

  ```solidity
  function setAllowance(uint256 tokenId, address spender) external
  ```

  Allows an address that holds tokens to provide allowance to another.

**Parameters**
* `tokenId` (*uint256*) - The token which should be allowed to spender
* `spender` (*address*) - The address that is given allowance.

#### setBaseTokenURI

  ```solidity
  function setBaseTokenURI(string uri) external
  ```

  Allows the owner to update the base token URI.

**Parameters**
* `uri` (*string*) - The new base token uri

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

### Associate Debt Module

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

**Parameters**
* `marketId` (*uint128*) - The id of the market to which debt was associated.
* `poolId` (*uint128*) - The id of the pool associated to the target market.
* `collateralType` (*address*) - The address of the collateral type that acts as collateral in the corresponding pool.
* `accountId` (*uint128*) - The id of the account whose debt is being associated.
* `amount` (*uint256*) - The amount of debt being associated with the specified account, denominated with 18 decimals of precision.

**Returns**
* `debtAmount` (*int256*) - The updated debt of the position, denominated with 18 decimals of precision.

#### DebtAssociated

  ```solidity
  event DebtAssociated(uint128 marketId, uint128 poolId, address collateralType, uint128 accountId, uint256 amount, int256 updatedDebt)
  ```

  Emitted when `associateDebt` is called.

**Parameters**
* `marketId` (*uint128*) - The id of the market to which debt was associated.
* `poolId` (*uint128*) - The id of the pool associated to the target market.
* `collateralType` (*address*) - The address of the collateral type that acts as collateral in the corresponding pool.
* `accountId` (*uint128*) - The id of the account whose debt is being associated.
* `amount` (*uint256*) - The amount of debt being associated with the specified account, denominated with 18 decimals of precision.
* `updatedDebt` (*int256*) - The total updated debt of the account, denominated with 18 decimals of precision

### Collateral Configuration Module

#### configureCollateral

  ```solidity
  function configureCollateral(struct CollateralConfiguration.Data config) external
  ```

  Creates or updates the configuration for the given `collateralType`.

**Parameters**
* `config` (*struct CollateralConfiguration.Data*) - The CollateralConfiguration object describing the new configuration. Requirements: - `msg.sender` must be the owner of the system. Emits a {CollateralConfigured} event.

#### getCollateralConfigurations

  ```solidity
  function getCollateralConfigurations(bool hideDisabled) external view returns (struct CollateralConfiguration.Data[] collaterals)
  ```

  Returns a list of detailed information pertaining to all collateral types registered in the system.

  Optionally returns only those that are currently enabled.

**Parameters**
* `hideDisabled` (*bool*) - Wether to hide disabled collaterals or just return the full list of collaterals in the system.

**Returns**
* `collaterals` (*struct CollateralConfiguration.Data[]*) - The list of collateral configuration objects set in the system.
#### getCollateralConfiguration

  ```solidity
  function getCollateralConfiguration(address collateralType) external view returns (struct CollateralConfiguration.Data collateral)
  ```

  Returns detailed information pertaining the specified collateral type.

**Parameters**
* `collateralType` (*address*) - The address for the collateral whose configuration is being queried.

**Returns**
* `collateral` (*struct CollateralConfiguration.Data*) - The configuration object describing the given collateral.
#### getCollateralPrice

  ```solidity
  function getCollateralPrice(address collateralType) external view returns (uint256 priceD18)
  ```

  Returns the current value of a specified collateral type.

**Parameters**
* `collateralType` (*address*) - The address for the collateral whose price is being queried.

**Returns**
* `priceD18` (*uint256*) - The price of the given collateral, denominated with 18 decimals of precision.

#### CollateralConfigured

  ```solidity
  event CollateralConfigured(address collateralType, struct CollateralConfiguration.Data config)
  ```

  Emitted when a collateral type’s configuration is created or updated.

**Parameters**
* `collateralType` (*address*) - The address of the collateral type that was just configured.
* `config` (*struct CollateralConfiguration.Data*) - The object with the newly configured details.

### Collateral Module

#### deposit

  ```solidity
  function deposit(uint128 accountId, address collateralType, uint256 tokenAmount) external
  ```

  Deposits `tokenAmount` of collateral of type `collateralType` into account `accountId`.

  Anyone can deposit into anyone's active account without restriction.

**Parameters**
* `accountId` (*uint128*) - The id of the account that is making the deposit.
* `collateralType` (*address*) - The address of the token to be deposited.
* `tokenAmount` (*uint256*) - The amount being deposited, denominated in the token's native decimal representation. Emits a {Deposited} event.

#### withdraw

  ```solidity
  function withdraw(uint128 accountId, address collateralType, uint256 tokenAmount) external
  ```

  Withdraws `tokenAmount` of collateral of type `collateralType` from account `accountId`.

**Parameters**
* `accountId` (*uint128*) - The id of the account that is making the withdrawal.
* `collateralType` (*address*) - The address of the token to be withdrawn.
* `tokenAmount` (*uint256*) - The amount being withdrawn, denominated in the token's native decimal representation. Requirements: - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `WITHDRAW` permission. Emits a {Withdrawn} event.

#### getAccountCollateral

  ```solidity
  function getAccountCollateral(uint128 accountId, address collateralType) external view returns (uint256 totalDeposited, uint256 totalAssigned, uint256 totalLocked)
  ```

  Returns the total values pertaining to account `accountId` for `collateralType`.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose collateral is being queried.
* `collateralType` (*address*) - The address of the collateral type whose amount is being queried.

**Returns**
* `totalDeposited` (*uint256*) - The total collateral deposited in the account, denominated with 18 decimals of precision.
* `totalAssigned` (*uint256*) - The amount of collateral in the account that is delegated to pools, denominated with 18 decimals of precision.
* `totalLocked` (*uint256*) - The amount of collateral in the account that cannot currently be undelegated from a pool, denominated with 18 decimals of precision.
#### getAccountAvailableCollateral

  ```solidity
  function getAccountAvailableCollateral(uint128 accountId, address collateralType) external view returns (uint256 amountD18)
  ```

  Returns the amount of collateral of type `collateralType` deposited with account `accountId` that can be withdrawn or delegated to pools.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose collateral is being queried.
* `collateralType` (*address*) - The address of the collateral type whose amount is being queried.

**Returns**
* `amountD18` (*uint256*) - The amount of collateral that is available for withdrawal or delegation, denominated with 18 decimals of precision.
#### cleanExpiredLocks

  ```solidity
  function cleanExpiredLocks(uint128 accountId, address collateralType, uint256 offset, uint256 count) external returns (uint256 cleared)
  ```

  Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited).

**Parameters**
* `accountId` (*uint128*) - The id of the account whose locks are being cleared.
* `collateralType` (*address*) - The address of the collateral type to clean locks for.
* `offset` (*uint256*) - The index of the first lock to clear.
* `count` (*uint256*) - The number of slots to check for cleaning locks. Set to 0 to clean all locks at/after offset

**Returns**
* `cleared` (*uint256*) - the number of locks that were actually expired (and therefore cleared)
#### getLocks

  ```solidity
  function getLocks(uint128 accountId, address collateralType, uint256 offset, uint256 count) external view returns (struct CollateralLock.Data[] locks)
  ```

  Get a list of locks existing in account. Lists all locks in storage, even if they are expired

**Parameters**
* `accountId` (*uint128*) - The id of the account whose locks we want to read
* `collateralType` (*address*) - The address of the collateral type for locks we want to read
* `offset` (*uint256*) - The index of the first lock to read
* `count` (*uint256*) - The number of slots to check for cleaning locks. Set to 0 to read all locks after offset

#### createLock

  ```solidity
  function createLock(uint128 accountId, address collateralType, uint256 amount, uint64 expireTimestamp) external
  ```

  Create a new lock on the given account. you must have `admin` permission on the specified account to create a lock.

  Collateral can be withdrawn from the system if it is not assigned or delegated to a pool. Collateral locks are an additional restriction that applies on top of that. I.e. if collateral is not assigned to a pool, but has a lock, it cannot be withdrawn.
Collateral locks are initially intended for the Synthetix v2 to v3 migration, but may be used in the future by the Spartan Council, for example, to create and hand off accounts whose withdrawals from the system are locked for a given amount of time.

**Parameters**
* `accountId` (*uint128*) - The id of the account for which a lock is to be created.
* `collateralType` (*address*) - The address of the collateral type for which the lock will be created.
* `amount` (*uint256*) - The amount of collateral tokens to wrap in the lock being created, denominated with 18 decimals of precision.
* `expireTimestamp` (*uint64*) - The date in which the lock will become clearable.

#### Deposited

  ```solidity
  event Deposited(uint128 accountId, address collateralType, uint256 tokenAmount, address sender)
  ```

  Emitted when `tokenAmount` of collateral of type `collateralType` is deposited to account `accountId` by `sender`.

**Parameters**
* `accountId` (*uint128*) - The id of the account that deposited collateral.
* `collateralType` (*address*) - The address of the collateral that was deposited.
* `tokenAmount` (*uint256*) - The amount of collateral that was deposited, denominated in the token's native decimal representation.
* `sender` (*address*) - The address of the account that triggered the deposit.

#### CollateralLockCreated

  ```solidity
  event CollateralLockCreated(uint128 accountId, address collateralType, uint256 tokenAmount, uint64 expireTimestamp)
  ```

  Emitted when a lock is created on someone's account

**Parameters**
* `accountId` (*uint128*) - The id of the account that received a lock
* `collateralType` (*address*) - The address of the collateral type that was locked
* `tokenAmount` (*uint256*) - The amount of collateral that was locked, demoninated in system units (1e18)
* `expireTimestamp` (*uint64*) - unix timestamp at which the lock is due to expire

#### CollateralLockExpired

  ```solidity
  event CollateralLockExpired(uint128 accountId, address collateralType, uint256 tokenAmount, uint64 expireTimestamp)
  ```

  Emitted when a lock is cleared from an account due to expiration

**Parameters**
* `accountId` (*uint128*) - The id of the account that has the expired lock
* `collateralType` (*address*) - The address of the collateral type that was unlocked
* `tokenAmount` (*uint256*) - The amount of collateral that was unlocked, demoninated in system units (1e18)
* `expireTimestamp` (*uint64*) - unix timestamp at which the unlock is due to expire

#### Withdrawn

  ```solidity
  event Withdrawn(uint128 accountId, address collateralType, uint256 tokenAmount, address sender)
  ```

  Emitted when `tokenAmount` of collateral of type `collateralType` is withdrawn from account `accountId` by `sender`.

**Parameters**
* `accountId` (*uint128*) - The id of the account that withdrew collateral.
* `collateralType` (*address*) - The address of the collateral that was withdrawn.
* `tokenAmount` (*uint256*) - The amount of collateral that was withdrawn, denominated in the token's native decimal representation.
* `sender` (*address*) - The address of the account that triggered the withdrawal.

<<<<<<< HEAD
## Cross ChainUSD Module

### transferCrossChain

  ```solidity
  function transferCrossChain(uint64 destChainId, uint256 amount) external payable returns (uint256 gasTokenUsed)
  ```

  Allows users to transfer tokens cross-chain using CCIP.

**Parameters**
* `destChainId` (*uint64*) - The id of the chain where tokens are to be transferred to.
* `amount` (*uint256*) - The amount of tokens to be transferred, denominated with 18 decimals of precision.

**Returns**
* `gasTokenUsed` (*uint256*) - The amount of fees paid in the cross-chain transfer, denominated with 18 decimals of precision.

### TransferCrossChainInitiated

  ```solidity
  event TransferCrossChainInitiated(uint64 destChainId, uint256 amount, address sender)
  ```

## IssueUSD Module
=======
### Cross ChainUSD Module
>>>>>>> sip-326-332-333-334

#### transferCrossChain

  ```solidity
  function transferCrossChain(uint64 destChainId, uint256 amount) external payable returns (uint256 gasTokenUsed)
  ```

  Allows users to transfer tokens cross-chain using CCIP.

**Parameters**
* `destChainId` (*uint64*) - The id of the chain where tokens are to be transferred to.
* `amount` (*uint256*) - The amount of tokens to be transferred, denominated with 18 decimals of precision.

**Returns**
* `gasTokenUsed` (*uint256*) - The amount of fees paid in the cross-chain transfer, denominated with 18 decimals of precision.

#### TransferCrossChainInitiated

  ```solidity
  event TransferCrossChainInitiated(uint64 destChainId, uint256 amount, address sender)
  ```

### IssueUSD Module

#### mintUsd

  ```solidity
  function mintUsd(uint128 accountId, uint128 poolId, address collateralType, uint256 amount) external
  ```

  Mints {amount} of snxUSD with the specified liquidity position.

**Parameters**
* `accountId` (*uint128*) - The id of the account that is minting snxUSD.
* `poolId` (*uint128*) - The id of the pool whose collateral will be used to back up the mint.
* `collateralType` (*address*) - The address of the collateral that will be used to back up the mint.
* `amount` (*uint256*) - The amount of snxUSD to be minted, denominated with 18 decimals of precision. Requirements: - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `MINT` permission. - After minting, the collateralization ratio of the liquidity position must not be below the target collateralization ratio for the corresponding collateral type. Emits a {UsdMinted} event.

#### burnUsd

  ```solidity
  function burnUsd(uint128 accountId, uint128 poolId, address collateralType, uint256 amount) external
  ```

  Burns {amount} of snxUSD with the specified liquidity position.

**Parameters**
* `accountId` (*uint128*) - The id of the account that is burning snxUSD.
* `poolId` (*uint128*) - The id of the pool whose collateral was used to back up the snxUSD.
* `collateralType` (*address*) - The address of the collateral that was used to back up the snxUSD.
* `amount` (*uint256*) - The amount of snxUSD to be burnt, denominated with 18 decimals of precision. Emits a {UsdMinted} event.

#### UsdMinted

  ```solidity
  event UsdMinted(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when {sender} mints {amount} of snxUSD with the specified liquidity position.

**Parameters**
* `accountId` (*uint128*) - The id of the account for which snxUSD was emitted.
* `poolId` (*uint128*) - The id of the pool whose collateral was used to emit the snxUSD.
* `collateralType` (*address*) - The address of the collateral that is backing up the emitted snxUSD.
* `amount` (*uint256*) - The amount of snxUSD emitted, denominated with 18 decimals of precision.
* `sender` (*address*) - The address that triggered the operation.

#### UsdBurned

  ```solidity
  event UsdBurned(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, address sender)
  ```

  Emitted when {sender} burns {amount} of snxUSD with the specified liquidity position.

**Parameters**
* `accountId` (*uint128*) - The id of the account for which snxUSD was burned.
* `poolId` (*uint128*) - The id of the pool whose collateral was used to emit the snxUSD.
* `collateralType` (*address*) - The address of the collateral that was backing up the emitted snxUSD.
* `amount` (*uint256*) - The amount of snxUSD burned, denominated with 18 decimals of precision.
* `sender` (*address*) - The address that triggered the operation.

#### IssuanceFeePaid

  ```solidity
  event IssuanceFeePaid(uint128 accountId, uint128 poolId, address collateralType, uint256 feeAmount)
  ```

### Liquidation Module

#### liquidate

  ```solidity
  function liquidate(uint128 accountId, uint128 poolId, address collateralType, uint128 liquidateAsAccountId) external returns (struct ILiquidationModule.LiquidationData liquidationData)
  ```

  Liquidates a position by distributing its debt and collateral among other positions in its vault.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose position is to be liquidated.
* `poolId` (*uint128*) - The id of the pool which holds the position that is to be liquidated.
* `collateralType` (*address*) - The address of the collateral being used in the position that is to be liquidated.
* `liquidateAsAccountId` (*uint128*) - Account id that will receive the rewards from the liquidation.

**Returns**
* `liquidationData` (*struct ILiquidationModule.LiquidationData*) - Information about the position that was liquidated.
#### liquidateVault

  ```solidity
  function liquidateVault(uint128 poolId, address collateralType, uint128 liquidateAsAccountId, uint256 maxUsd) external returns (struct ILiquidationModule.LiquidationData liquidationData)
  ```

  Liquidates an entire vault.

  Can only be done if the vault itself is under collateralized.
LiquidateAsAccountId determines which account to deposit the seized collateral into (this is necessary particularly if the collateral in the vault is vesting).
Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose vault is being liquidated.
* `collateralType` (*address*) - The address of the collateral whose vault is being liquidated.
* `liquidateAsAccountId` (*uint128*) - 
* `maxUsd` (*uint256*) - The maximum amount of USD that the liquidator is willing to provide for the liquidation, denominated with 18 decimals of precision.

**Returns**
* `liquidationData` (*struct ILiquidationModule.LiquidationData*) - Information about the vault that was liquidated.
#### isPositionLiquidatable

  ```solidity
  function isPositionLiquidatable(uint128 accountId, uint128 poolId, address collateralType) external returns (bool canLiquidate)
  ```

  Determines whether a specified position is liquidatable.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose position is being queried for liquidation.
* `poolId` (*uint128*) - The id of the pool whose position is being queried for liquidation.
* `collateralType` (*address*) - The address of the collateral backing up the position being queried for liquidation.

**Returns**
* `canLiquidate` (*bool*) - A boolean with the response to the query.
#### isVaultLiquidatable

  ```solidity
  function isVaultLiquidatable(uint128 poolId, address collateralType) external returns (bool canVaultLiquidate)
  ```

  Determines whether a specified vault is liquidatable.

**Parameters**
* `poolId` (*uint128*) - The id of the pool that owns the vault that is being queried for liquidation.
* `collateralType` (*address*) - The address of the collateral being held at the vault that is being queried for liquidation.

**Returns**
* `canVaultLiquidate` (*bool*) - A boolean with the response to the query.

#### Liquidation

  ```solidity
  event Liquidation(uint128 accountId, uint128 poolId, address collateralType, struct ILiquidationModule.LiquidationData liquidationData, uint128 liquidateAsAccountId, address sender)
  ```

  Emitted when an account is liquidated.

**Parameters**
* `accountId` (*uint128*) - The id of the account that was liquidated.
* `poolId` (*uint128*) - The pool id of the position that was liquidated.
* `collateralType` (*address*) - The collateral type used in the position that was liquidated.
* `liquidationData` (*struct ILiquidationModule.LiquidationData*) - The amount of collateral liquidated, debt liquidated, and collateral awarded to the liquidator.
* `liquidateAsAccountId` (*uint128*) - Account id that will receive the rewards from the liquidation.
* `sender` (*address*) - The address of the account that is triggering the liquidation.

#### VaultLiquidation

  ```solidity
  event VaultLiquidation(uint128 poolId, address collateralType, struct ILiquidationModule.LiquidationData liquidationData, uint128 liquidateAsAccountId, address sender)
  ```

  Emitted when a vault is liquidated.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose vault was liquidated.
* `collateralType` (*address*) - The collateral address of the vault that was liquidated.
* `liquidationData` (*struct ILiquidationModule.LiquidationData*) - The amount of collateral liquidated, debt liquidated, and collateral awarded to the liquidator.
* `liquidateAsAccountId` (*uint128*) - Account id that will receive the rewards from the liquidation.
* `sender` (*address*) - The address of the account that is triggering the liquidation.

### Market Collateral Module

#### depositMarketCollateral

  ```solidity
  function depositMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

  Allows a market to deposit collateral.

**Parameters**
* `marketId` (*uint128*) - The id of the market in which the collateral was directly deposited.
* `collateralType` (*address*) - The address of the collateral that was deposited in the market.
* `amount` (*uint256*) - The amount of collateral that was deposited, denominated in the token's native decimal representation.

#### withdrawMarketCollateral

  ```solidity
  function withdrawMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

  Allows a market to withdraw collateral that it has previously deposited.

**Parameters**
* `marketId` (*uint128*) - The id of the market from which the collateral was withdrawn.
* `collateralType` (*address*) - The address of the collateral that was withdrawn from the market.
* `amount` (*uint256*) - The amount of collateral that was withdrawn, denominated in the token's native decimal representation.

#### configureMaximumMarketCollateral

  ```solidity
  function configureMaximumMarketCollateral(uint128 marketId, address collateralType, uint256 amount) external
  ```

  Allow the system owner to configure the maximum amount of a given collateral type that a specified market is allowed to deposit.

**Parameters**
* `marketId` (*uint128*) - The id of the market for which the maximum is to be configured.
* `collateralType` (*address*) - The address of the collateral for which the maximum is to be applied.
* `amount` (*uint256*) - The amount that is to be set as the new maximum, denominated with 18 decimals of precision.

#### getMaximumMarketCollateral

  ```solidity
  function getMaximumMarketCollateral(uint128 marketId, address collateralType) external returns (uint256 amountD18)
  ```

  Return the total maximum amount of a given collateral type that a specified market is allowed to deposit.

**Parameters**
* `marketId` (*uint128*) - The id of the market for which the maximum is being queried.
* `collateralType` (*address*) - The address of the collateral for which the maximum is being queried.

**Returns**
* `amountD18` (*uint256*) - The maximum amount of collateral set for the market, denominated with 18 decimals of precision.
#### getMarketCollateralAmount

  ```solidity
  function getMarketCollateralAmount(uint128 marketId, address collateralType) external view returns (uint256 amountD18)
  ```

  Return the total amount of a given collateral type that a specified market has deposited.

**Parameters**
* `marketId` (*uint128*) - The id of the market for which the directly deposited collateral amount is being queried.
* `collateralType` (*address*) - The address of the collateral for which the amount is being queried.

**Returns**
* `amountD18` (*uint256*) - The total amount of collateral of this type delegated to the market, denominated with 18 decimals of precision.
#### getMarketCollateralValue

  ```solidity
  function getMarketCollateralValue(uint128 marketId) external returns (uint256 valueD18)
  ```

  Return the total value of collateral that a specified market has deposited.

**Parameters**
* `marketId` (*uint128*) - The id of the market for which the directly deposited collateral amount is being queried.

**Returns**
* `valueD18` (*uint256*) - The total value of collateral deposited by the market, denominated with 18 decimals of precision.

#### MarketCollateralDeposited

  ```solidity
  event MarketCollateralDeposited(uint128 marketId, address collateralType, uint256 tokenAmount, address sender)
  ```

  Emitted when `amount` of collateral of type `collateralType` is deposited to market `marketId` by `sender`.

**Parameters**
* `marketId` (*uint128*) - The id of the market in which collateral was deposited.
* `collateralType` (*address*) - The address of the collateral that was directly deposited in the market.
* `tokenAmount` (*uint256*) - The amount of tokens that were deposited, denominated in the token's native decimal representation.
* `sender` (*address*) - The address that triggered the deposit.

#### MarketCollateralWithdrawn

  ```solidity
  event MarketCollateralWithdrawn(uint128 marketId, address collateralType, uint256 tokenAmount, address sender)
  ```

  Emitted when `amount` of collateral of type `collateralType` is withdrawn from market `marketId` by `sender`.

**Parameters**
* `marketId` (*uint128*) - The id of the market from which collateral was withdrawn.
* `collateralType` (*address*) - The address of the collateral that was withdrawn from the market.
* `tokenAmount` (*uint256*) - The amount of tokens that were withdrawn, denominated in the token's native decimal representation.
* `sender` (*address*) - The address that triggered the withdrawal.

#### MaximumMarketCollateralConfigured

  ```solidity
  event MaximumMarketCollateralConfigured(uint128 marketId, address collateralType, uint256 systemAmount, address owner)
  ```

  Emitted when the system owner specifies the maximum depositable collateral of a given type in a given market.

**Parameters**
* `marketId` (*uint128*) - The id of the market for which the maximum was configured.
* `collateralType` (*address*) - The address of the collateral for which the maximum was configured.
* `systemAmount` (*uint256*) - The amount to which the maximum was set, denominated with 18 decimals of precision.
* `owner` (*address*) - The owner of the system, which triggered the configuration change.

### Market Manager Module

#### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint128 newMarketId)
  ```

  Connects an external market to the system.

  Creates a Market object to track the external market, and returns the newly created market id.

**Parameters**
* `market` (*address*) - The address of the external market that is to be registered in the system.

**Returns**
* `newMarketId` (*uint128*) - The id with which the market will be registered in the system.
#### depositMarketUsd

  ```solidity
  function depositMarketUsd(uint128 marketId, address target, uint256 amount) external returns (uint256 feeAmount)
  ```

  Allows an external market connected to the system to deposit USD in the system.

  The system burns the incoming USD, increases the market's credit capacity, and reduces its issuance.
See `IMarket`.

**Parameters**
* `marketId` (*uint128*) - The id of the market in which snxUSD will be deposited.
* `target` (*address*) - The address of the account on who's behalf the deposit will be made.
* `amount` (*uint256*) - The amount of snxUSD to be deposited, denominated with 18 decimals of precision.

**Returns**
* `feeAmount` (*uint256*) - the amount of fees paid (billed as additional debt towards liquidity providers)
#### withdrawMarketUsd

  ```solidity
  function withdrawMarketUsd(uint128 marketId, address target, uint256 amount) external returns (uint256 feeAmount)
  ```

  Allows an external market connected to the system to withdraw snxUSD from the system.

  The system mints the requested snxUSD (provided that the market has sufficient credit), reduces the market's credit capacity, and increases its net issuance.
See `IMarket`.

**Parameters**
* `marketId` (*uint128*) - The id of the market from which snxUSD will be withdrawn.
* `target` (*address*) - The address of the account that will receive the withdrawn snxUSD.
* `amount` (*uint256*) - The amount of snxUSD to be withdraw, denominated with 18 decimals of precision.

**Returns**
* `feeAmount` (*uint256*) - the amount of fees paid (billed as additional debt towards liquidity providers)
#### getMarketFees

  ```solidity
  function getMarketFees(uint128 marketId, uint256 amount) external view returns (uint256 depositFeeAmount, uint256 withdrawFeeAmount)
  ```

  Get the amount of fees paid in USD for a call to `depositMarketUsd` and `withdrawMarketUsd` for the given market and amount

**Parameters**
* `marketId` (*uint128*) - The market to check fees for
* `amount` (*uint256*) - The amount deposited or withdrawn in USD

**Returns**
* `depositFeeAmount` (*uint256*) - the amount of USD paid for a call to `depositMarketUsd`
* `withdrawFeeAmount` (*uint256*) - the amount of USD paid for a call to `withdrawMarketUsd`
#### getWithdrawableMarketUsd

  ```solidity
  function getWithdrawableMarketUsd(uint128 marketId) external view returns (uint256 withdrawableD18)
  ```

  Returns the total withdrawable snxUSD amount for the specified market.

**Parameters**
* `marketId` (*uint128*) - The id of the market whose withdrawable USD amount is being queried.

**Returns**
* `withdrawableD18` (*uint256*) - The total amount of snxUSD that the market could withdraw at the time of the query, denominated with 18 decimals of precision.
<<<<<<< HEAD
### getMarketAddress

  ```solidity
  function getMarketAddress(uint128 marketId) external view returns (address marketAddress)
  ```

  Returns the contract address for the specified market.

**Parameters**
* `marketId` (*uint128*) - The id of the market

**Returns**
* `marketAddress` (*address*) - The contract address for the specified market
### getMarketNetIssuance
=======
#### getMarketNetIssuance
>>>>>>> sip-326-332-333-334

  ```solidity
  function getMarketNetIssuance(uint128 marketId) external view returns (int128 issuanceD18)
  ```

  Returns the net issuance of the specified market (snxUSD withdrawn - snxUSD deposited).

**Parameters**
* `marketId` (*uint128*) - The id of the market whose net issuance is being queried.

**Returns**
* `issuanceD18` (*int128*) - The net issuance of the market, denominated with 18 decimals of precision.
#### getMarketReportedDebt

  ```solidity
  function getMarketReportedDebt(uint128 marketId) external view returns (uint256 reportedDebtD18)
  ```

  Returns the reported debt of the specified market.

**Parameters**
* `marketId` (*uint128*) - The id of the market whose reported debt is being queried.

**Returns**
* `reportedDebtD18` (*uint256*) - The market's reported debt, denominated with 18 decimals of precision.
#### getMarketTotalDebt

  ```solidity
  function getMarketTotalDebt(uint128 marketId) external view returns (int256 totalDebtD18)
  ```

  Returns the total debt of the specified market.

**Parameters**
* `marketId` (*uint128*) - The id of the market whose debt is being queried.

**Returns**
* `totalDebtD18` (*int256*) - The total debt of the market, denominated with 18 decimals of precision.
#### getMarketCollateral

  ```solidity
  function getMarketCollateral(uint128 marketId) external view returns (uint256 valueD18)
  ```

  Returns the total snxUSD value of the collateral for the specified market.

**Parameters**
* `marketId` (*uint128*) - The id of the market whose collateral is being queried.

**Returns**
* `valueD18` (*uint256*) - The market's total snxUSD value of collateral, denominated with 18 decimals of precision.
#### getMarketDebtPerShare

  ```solidity
  function getMarketDebtPerShare(uint128 marketId) external returns (int256 debtPerShareD18)
  ```

  Returns the value per share of the debt of the specified market.

  This is not a view function, and actually updates the entire debt distribution chain.

**Parameters**
* `marketId` (*uint128*) - The id of the market whose debt per share is being queried.

**Returns**
* `debtPerShareD18` (*int256*) - The market's debt per share value, denominated with 18 decimals of precision.
#### isMarketCapacityLocked

  ```solidity
  function isMarketCapacityLocked(uint128 marketId) external view returns (bool isLocked)
  ```

  Returns whether the capacity of the specified market is locked.

**Parameters**
* `marketId` (*uint128*) - The id of the market whose capacity is being queried.

**Returns**
* `isLocked` (*bool*) - A boolean that is true if the market's capacity is locked at the time of the query.
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

**Parameters**
* `marketId` (*uint128*) - the id of the market that needs pools bumped
* `maxIter` (*uint256*) - 

**Returns**
* `finishedDistributing` (*bool*) - whether or not all bumpable pools have been bumped and target price has been reached
#### setMarketMinDelegateTime

  ```solidity
  function setMarketMinDelegateTime(uint128 marketId, uint32 minDelegateTime) external
  ```

  allows for a market to set its minimum delegation time. This is useful for preventing stakers from frontrunning rewards or losses
by limiting the frequency of `delegateCollateral` (or `setPoolConfiguration`) calls. By default, there is no minimum delegation time.

**Parameters**
* `marketId` (*uint128*) - the id of the market that wants to set delegation time.
* `minDelegateTime` (*uint32*) - the minimum number of seconds between delegation calls. Note: this value must be less than the globally defined maximum minDelegateTime

#### getMarketMinDelegateTime

  ```solidity
  function getMarketMinDelegateTime(uint128 marketId) external view returns (uint32)
  ```

  Retrieve the minimum delegation time of a market

**Parameters**
* `marketId` (*uint128*) - the id of the market

#### setMinLiquidityRatio

  ```solidity
  function setMinLiquidityRatio(uint128 marketId, uint256 minLiquidityRatio) external
  ```

  Allows the system owner (not the pool owner) to set a market-specific minimum liquidity ratio.

**Parameters**
* `marketId` (*uint128*) - the id of the market
* `minLiquidityRatio` (*uint256*) - The new market-specific minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)

#### getMinLiquidityRatio

  ```solidity
  function getMinLiquidityRatio(uint128 marketId) external view returns (uint256 minRatioD18)
  ```

  Retrieves the market-specific minimum liquidity ratio.

**Parameters**
* `marketId` (*uint128*) - the id of the market

**Returns**
* `minRatioD18` (*uint256*) - The current market-specific minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)
#### getMarketPools

  ```solidity
  function getMarketPools(uint128 marketId) external returns (uint128[] inRangePoolIds, uint128[] outRangePoolIds)
  ```

#### getMarketPoolDebtDistribution

  ```solidity
  function getMarketPoolDebtDistribution(uint128 marketId, uint128 poolId) external returns (uint256 sharesD18, uint128 totalSharesD18, int128 valuePerShareD27)
  ```

#### MarketRegistered

  ```solidity
  event MarketRegistered(address market, uint128 marketId, address sender)
  ```

  Emitted when a new market is registered in the system.

**Parameters**
* `market` (*address*) - The address of the external market that was registered in the system.
* `marketId` (*uint128*) - The id with which the market was registered in the system.
* `sender` (*address*) - The account that trigger the registration of the market.

#### MarketUsdDeposited

  ```solidity
  event MarketUsdDeposited(uint128 marketId, address target, uint256 amount, address market)
  ```

  Emitted when a market deposits snxUSD in the system.

**Parameters**
* `marketId` (*uint128*) - The id of the market that deposited snxUSD in the system.
* `target` (*address*) - The address of the account that provided the snxUSD in the deposit.
* `amount` (*uint256*) - The amount of snxUSD deposited in the system, denominated with 18 decimals of precision.
* `market` (*address*) - The address of the external market that is depositing.

#### MarketUsdWithdrawn

  ```solidity
  event MarketUsdWithdrawn(uint128 marketId, address target, uint256 amount, address market)
  ```

  Emitted when a market withdraws snxUSD from the system.

**Parameters**
* `marketId` (*uint128*) - The id of the market that withdrew snxUSD from the system.
* `target` (*address*) - The address of the account that received the snxUSD in the withdrawal.
* `amount` (*uint256*) - The amount of snxUSD withdrawn from the system, denominated with 18 decimals of precision.
* `market` (*address*) - The address of the external market that is withdrawing.

#### MarketSystemFeePaid

  ```solidity
  event MarketSystemFeePaid(uint128 marketId, uint256 feeAmount)
  ```

#### SetMinDelegateTime

  ```solidity
  event SetMinDelegateTime(uint128 marketId, uint32 minDelegateTime)
  ```

  Emitted when a market sets an updated minimum delegation time

**Parameters**
* `marketId` (*uint128*) - The id of the market that the setting is applied to
* `minDelegateTime` (*uint32*) - The minimum amount of time between delegation changes

#### SetMarketMinLiquidityRatio

  ```solidity
  event SetMarketMinLiquidityRatio(uint128 marketId, uint256 minLiquidityRatio)
  ```

  Emitted when a market-specific minimum liquidity ratio is set

**Parameters**
* `marketId` (*uint128*) - The id of the market that the setting is applied to
* `minLiquidityRatio` (*uint256*) - The new market-specific minimum liquidity ratio

### Multicall Module

#### multicall

  ```solidity
  function multicall(bytes[] data) external payable returns (bytes[] results)
  ```

  Executes multiple transaction payloads in a single transaction.

  Each transaction is executed using `delegatecall`, and targets the system address.

**Parameters**
* `data` (*bytes[]*) - Array of calldata objects, one for each function that is to be called in the system.

**Returns**
* `results` (*bytes[]*) - Array of each `delegatecall`'s response corresponding to the incoming calldata array.

### Pool Configuration Module

#### setPreferredPool

  ```solidity
  function setPreferredPool(uint128 poolId) external
  ```

  Sets the unique system preferred pool.

  Note: The preferred pool does not receive any special treatment. It is only signaled as preferred here.

**Parameters**
* `poolId` (*uint128*) - The id of the pool that is to be set as preferred.

#### addApprovedPool

  ```solidity
  function addApprovedPool(uint128 poolId) external
  ```

  Marks a pool as approved by the system owner.

  Approved pools do not receive any special treatment. They are only signaled as approved here.

**Parameters**
* `poolId` (*uint128*) - The id of the pool that is to be approved.

#### removeApprovedPool

  ```solidity
  function removeApprovedPool(uint128 poolId) external
  ```

  Un-marks a pool as preferred by the system owner.

**Parameters**
* `poolId` (*uint128*) - The id of the pool that is to be no longer approved.

#### getPreferredPool

  ```solidity
  function getPreferredPool() external view returns (uint128 poolId)
  ```

  Retrieves the unique system preferred pool.

**Returns**
* `poolId` (*uint128*) - The id of the pool that is currently set as preferred in the system.
#### getApprovedPools

  ```solidity
  function getApprovedPools() external view returns (uint256[] poolIds)
  ```

  Retrieves the pool that are approved by the system owner.

**Returns**
* `poolIds` (*uint256[]*) - An array with all of the pool ids that are approved in the system.

#### PreferredPoolSet

  ```solidity
  event PreferredPoolSet(uint256 poolId)
  ```

  Emitted when the system owner sets the preferred pool.

**Parameters**
* `poolId` (*uint256*) - The id of the pool that was set as preferred.

#### PoolApprovedAdded

  ```solidity
  event PoolApprovedAdded(uint256 poolId)
  ```

  Emitted when the system owner adds an approved pool.

**Parameters**
* `poolId` (*uint256*) - The id of the pool that was approved.

#### PoolApprovedRemoved

  ```solidity
  event PoolApprovedRemoved(uint256 poolId)
  ```

  Emitted when the system owner removes an approved pool.

**Parameters**
* `poolId` (*uint256*) - The id of the pool that is no longer approved.

### Pool Module

#### createPool

  ```solidity
  function createPool(uint128 requestedPoolId, address owner) external
  ```

  Creates a pool with the requested pool id.

**Parameters**
* `requestedPoolId` (*uint128*) - The requested id for the new pool. Reverts if the id is not available.
* `owner` (*address*) - The address that will own the newly created pool.

#### setPoolConfiguration

  ```solidity
  function setPoolConfiguration(uint128 poolId, struct MarketConfiguration.Data[] marketDistribution) external
  ```

  Allows the pool owner to configure the pool.

  The pool's configuration is composed of an array of MarketConfiguration objects, which describe which markets the pool provides liquidity to, in what proportion, and to what extent.
Incoming market ids need to be provided in ascending order.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose configuration is being set.
* `marketDistribution` (*struct MarketConfiguration.Data[]*) - The array of market configuration objects that define the list of markets that are connected to the system.

#### getPoolConfiguration

  ```solidity
  function getPoolConfiguration(uint128 poolId) external view returns (struct MarketConfiguration.Data[] markets)
  ```

  Retrieves the MarketConfiguration of the specified pool.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose configuration is being queried.

**Returns**
* `markets` (*struct MarketConfiguration.Data[]*) - The array of MarketConfiguration objects that describe the pool's configuration.
#### setPoolName

  ```solidity
  function setPoolName(uint128 poolId, string name) external
  ```

  Allows the owner of the pool to set the pool's name.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose name is being set.
* `name` (*string*) - The new name to give to the pool.

#### getPoolName

  ```solidity
  function getPoolName(uint128 poolId) external view returns (string poolName)
  ```

  Returns the pool's name.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose name is being queried.

**Returns**
* `poolName` (*string*) - The current name of the pool.
#### nominatePoolOwner

  ```solidity
  function nominatePoolOwner(address nominatedOwner, uint128 poolId) external
  ```

  Allows the current pool owner to nominate a new owner.

**Parameters**
* `nominatedOwner` (*address*) - The address to nominate os the new pool owner.
* `poolId` (*uint128*) - The id whose ownership is being transferred.

#### acceptPoolOwnership

  ```solidity
  function acceptPoolOwnership(uint128 poolId) external
  ```

  After a new pool owner has been nominated, allows it to accept the nomination and thus ownership of the pool.

**Parameters**
* `poolId` (*uint128*) - The id of the pool for which the caller is to accept ownership.

#### revokePoolNomination

  ```solidity
  function revokePoolNomination(uint128 poolId) external
  ```

  After a new pool owner has been nominated, allows it to reject the nomination.

**Parameters**
* `poolId` (*uint128*) - The id of the pool for which the new owner nomination is to be revoked.

#### renouncePoolNomination

  ```solidity
  function renouncePoolNomination(uint128 poolId) external
  ```

  Allows the current nominated owner to renounce the nomination.

**Parameters**
* `poolId` (*uint128*) - The id of the pool for which the caller is renouncing ownership nomination.

#### getPoolOwner

  ```solidity
  function getPoolOwner(uint128 poolId) external view returns (address owner)
  ```

  Returns the current pool owner.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose ownership is being queried.

**Returns**
* `owner` (*address*) - The current owner of the pool.
#### getNominatedPoolOwner

  ```solidity
  function getNominatedPoolOwner(uint128 poolId) external view returns (address nominatedOwner)
  ```

  Returns the current nominated pool owner.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose nominated owner is being queried.

**Returns**
* `nominatedOwner` (*address*) - The current nominated owner of the pool.
#### setMinLiquidityRatio

  ```solidity
  function setMinLiquidityRatio(uint256 minLiquidityRatio) external
  ```

  Allows the system owner (not the pool owner) to set the system-wide minimum liquidity ratio.

**Parameters**
* `minLiquidityRatio` (*uint256*) - The new system-wide minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)

#### getMinLiquidityRatio

  ```solidity
  function getMinLiquidityRatio() external view returns (uint256 minRatioD18)
  ```

  Retrieves the system-wide minimum liquidity ratio.

**Returns**
* `minRatioD18` (*uint256*) - The current system-wide minimum liquidity ratio, denominated with 18 decimals of precision. (100% is represented by 1 followed by 18 zeros.)
#### rebalancePool

  ```solidity
  function rebalancePool(uint128 poolId, address optionalCollateralType) external
  ```

  Distributes cached debt in a pool to its vaults and updates market credit capacities.

**Parameters**
* `poolId` (*uint128*) - the pool to rebalance
* `optionalCollateralType` (*address*) - in addition to rebalancing the pool, calculate updated collaterals and debts for the specified vault

#### PoolCreated

  ```solidity
  event PoolCreated(uint128 poolId, address owner, address sender)
  ```

  Gets fired when pool will be created.

**Parameters**
* `poolId` (*uint128*) - The id of the newly created pool.
* `owner` (*address*) - The owner of the newly created pool.
* `sender` (*address*) - The address that triggered the creation of the pool.

#### PoolOwnerNominated

  ```solidity
  event PoolOwnerNominated(uint128 poolId, address nominatedOwner, address owner)
  ```

  Gets fired when pool owner proposes a new owner.

**Parameters**
* `poolId` (*uint128*) - The id of the pool for which the nomination ocurred.
* `nominatedOwner` (*address*) - The address that was nominated as the new owner of the pool.
* `owner` (*address*) - The address of the current owner of the pool.

#### PoolOwnershipAccepted

  ```solidity
  event PoolOwnershipAccepted(uint128 poolId, address owner)
  ```

  Gets fired when pool nominee accepts nomination.

**Parameters**
* `poolId` (*uint128*) - The id of the pool for which the owner nomination was accepted.
* `owner` (*address*) - The address of the new owner of the pool, which accepted the nomination.

#### PoolNominationRevoked

  ```solidity
  event PoolNominationRevoked(uint128 poolId, address owner)
  ```

  Gets fired when pool owner revokes nomination.

**Parameters**
* `poolId` (*uint128*) - The id of the pool in which the nomination was revoked.
* `owner` (*address*) - The current owner of the pool.

#### PoolNominationRenounced

  ```solidity
  event PoolNominationRenounced(uint128 poolId, address owner)
  ```

  Gets fired when pool nominee renounces nomination.

**Parameters**
* `poolId` (*uint128*) - The id of the pool for which the owner nomination was renounced.
* `owner` (*address*) - The current owner of the pool.

#### PoolNameUpdated

  ```solidity
  event PoolNameUpdated(uint128 poolId, string name, address sender)
  ```

  Gets fired when pool name changes.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose name was updated.
* `name` (*string*) - The new name of the pool.
* `sender` (*address*) - The address that triggered the rename of the pool.

#### PoolConfigurationSet

  ```solidity
  event PoolConfigurationSet(uint128 poolId, struct MarketConfiguration.Data[] markets, address sender)
  ```

  Gets fired when pool gets configured.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose configuration was set.
* `markets` (*struct MarketConfiguration.Data[]*) - Array of configuration data of the markets that were connected to the pool.
* `sender` (*address*) - The address that triggered the pool configuration.

#### SetMinLiquidityRatio

  ```solidity
  event SetMinLiquidityRatio(uint256 minLiquidityRatio)
  ```

  Emitted when a system-wide minimum liquidity ratio is set

**Parameters**
* `minLiquidityRatio` (*uint256*) - The new system-wide minimum liquidity ratio

### Rewards Manager Module

#### registerRewardsDistributor

  ```solidity
  function registerRewardsDistributor(uint128 poolId, address collateralType, address distributor) external
  ```

  Called by pool owner to register rewards for vault participants.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose rewards are to be managed by the specified distributor.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `distributor` (*address*) - The address of the reward distributor to be registered.

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

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose rewards are to be managed by the specified distributor.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `distributor` (*address*) - The address of the reward distributor to be registered.

#### distributeRewards

  ```solidity
  function distributeRewards(uint128 poolId, address collateralType, uint256 amount, uint64 start, uint32 duration) external
  ```

  Called by a registered distributor to set up rewards for vault participants.

  Will revert if the caller is not a registered distributor.

**Parameters**
* `poolId` (*uint128*) - The id of the pool to distribute rewards to.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `amount` (*uint256*) - The amount of rewards to be distributed.
* `start` (*uint64*) - The date at which the rewards will begin to be claimable.
* `duration` (*uint32*) - The period after which all distributed rewards will be claimable.

#### claimRewards

  ```solidity
  function claimRewards(uint128 accountId, uint128 poolId, address collateralType, address distributor) external returns (uint256 amountClaimedD18)
  ```

  Allows a user with appropriate permissions to claim rewards associated with a position.

**Parameters**
* `accountId` (*uint128*) - The id of the account that is to claim the rewards.
* `poolId` (*uint128*) - The id of the pool to claim rewards on.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `distributor` (*address*) - The address of the rewards distributor associated with the rewards being claimed.

**Returns**
* `amountClaimedD18` (*uint256*) - The amount of rewards that were available for the account and thus claimed.
#### updateRewards

  ```solidity
  function updateRewards(uint128 poolId, address collateralType, uint128 accountId) external returns (uint256[] claimableD18, address[] distributors)
  ```

  For a given position, return the rewards that can currently be claimed.

**Parameters**
* `poolId` (*uint128*) - The id of the pool being queried.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `accountId` (*uint128*) - The id of the account whose available rewards are being queried.

**Returns**
* `claimableD18` (*uint256[]*) - An array of ids of the reward entries that are claimable by the position.
* `distributors` (*address[]*) - An array with the addresses of the reward distributors associated with the claimable rewards.
#### getRewardRate

  ```solidity
  function getRewardRate(uint128 poolId, address collateralType, address distributor) external view returns (uint256 rateD18)
  ```

  Returns the number of individual units of amount emitted per second per share for the given poolId, collateralType, distributor vault.

**Parameters**
* `poolId` (*uint128*) - The id of the pool being queried.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `distributor` (*address*) - The address of the rewards distributor associated with the rewards in question.

**Returns**
* `rateD18` (*uint256*) - The queried rewards rate.

#### RewardsDistributed

  ```solidity
  event RewardsDistributed(uint128 poolId, address collateralType, address distributor, uint256 amount, uint256 start, uint256 duration)
  ```

  Emitted when the pool owner or an existing reward distributor sets up rewards for vault participants.

**Parameters**
* `poolId` (*uint128*) - The id of the pool on which rewards were distributed.
* `collateralType` (*address*) - The collateral type of the pool on which rewards were distributed.
* `distributor` (*address*) - The reward distributor associated to the rewards that were distributed.
* `amount` (*uint256*) - The amount of rewards that were distributed.
* `start` (*uint256*) - The date one which the rewards will begin to be claimable.
* `duration` (*uint256*) - The time in which all of the distributed rewards will be claimable.

#### RewardsClaimed

  ```solidity
  event RewardsClaimed(uint128 accountId, uint128 poolId, address collateralType, address distributor, uint256 amount)
  ```

  Emitted when a vault participant claims rewards.

**Parameters**
* `accountId` (*uint128*) - The id of the account that claimed the rewards.
* `poolId` (*uint128*) - The id of the pool where the rewards were claimed.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `distributor` (*address*) - The address of the rewards distributor associated with these rewards.
* `amount` (*uint256*) - The amount of rewards that were claimed.

#### RewardsDistributorRegistered

  ```solidity
  event RewardsDistributorRegistered(uint128 poolId, address collateralType, address distributor)
  ```

  Emitted when a new rewards distributor is registered.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose reward distributor was registered.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `distributor` (*address*) - The address of the newly registered reward distributor.

#### RewardsDistributorRemoved

  ```solidity
  event RewardsDistributorRemoved(uint128 poolId, address collateralType, address distributor)
  ```

  Emitted when an already registered rewards distributor is removed.

**Parameters**
* `poolId` (*uint128*) - The id of the pool whose reward distributor was registered.
* `collateralType` (*address*) - The address of the collateral used in the pool's rewards.
* `distributor` (*address*) - The address of the registered reward distributor.

### USD Token Module

#### burnWithAllowance

  ```solidity
  function burnWithAllowance(address from, address spender, uint256 amount) external
  ```

  Allows the core system to burn snxUSD held by the `from` address, provided that it has given allowance to `spender`.

**Parameters**
* `from` (*address*) - The address that holds the snxUSD to be burned.
* `spender` (*address*) - The address to which the holder has given allowance to.
* `amount` (*uint256*) - The amount of snxUSD to be burned, denominated with 18 decimals of precision.

<<<<<<< HEAD
### burn
=======
#### burn
>>>>>>> sip-326-332-333-334

  ```solidity
  function burn(uint256 amount) external
  ```

  Destroys `amount` of snxUSD tokens from the caller. This is derived from ERC20Burnable.sol and is currently included for testing purposes with CCIP token pools.

**Parameters**
* `amount` (*uint256*) - The amount of snxUSD to be burned, denominated with 18 decimals of precision.

<<<<<<< HEAD
### isInitialized
=======
#### isInitialized
>>>>>>> sip-326-332-333-334

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns wether the token has been initialized.

**Returns**
* `[0]` (*bool*) - A boolean with the result of the query.
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

**Parameters**
* `to` (*address*) - The address to receive the newly minted tokens.
* `amount` (*uint256*) - The amount of tokens to mint.

#### burn

  ```solidity
  function burn(address from, uint256 amount) external
  ```

  Allows the owner to burn tokens.

**Parameters**
* `from` (*address*) - The address whose tokens will be burnt.
* `amount` (*uint256*) - The amount of tokens to burn.

#### setAllowance

  ```solidity
  function setAllowance(address from, address spender, uint256 amount) external
  ```

  Allows an address that holds tokens to provide allowance to another.

**Parameters**
* `from` (*address*) - The address that is providing allowance.
* `spender` (*address*) - The address that is given allowance.
* `amount` (*uint256*) - The amount of allowance being given.

#### name

  ```solidity
  function name() external view returns (string)
  ```

  Retrieves the name of the token, e.g. "Synthetix Network Token".

**Returns**
* `[0]` (*string*) - A string with the name of the token.
#### symbol

  ```solidity
  function symbol() external view returns (string)
  ```

  Retrieves the symbol of the token, e.g. "SNX".

**Returns**
* `[0]` (*string*) - A string with the symbol of the token.
#### decimals

  ```solidity
  function decimals() external view returns (uint8)
  ```

  Retrieves the number of decimals used by the token. The default is 18.

**Returns**
* `[0]` (*uint8*) - The number of decimals.
#### totalSupply

  ```solidity
  function totalSupply() external view returns (uint256)
  ```

  Returns the total number of tokens in circulation (minted - burnt).

**Returns**
* `[0]` (*uint256*) - The total number of tokens.
#### balanceOf

  ```solidity
  function balanceOf(address owner) external view returns (uint256)
  ```

  Returns the balance of a user.

**Parameters**
* `owner` (*address*) - The address whose balance is being retrieved.

**Returns**
* `[0]` (*uint256*) - The number of tokens owned by the user.
#### allowance

  ```solidity
  function allowance(address owner, address spender) external view returns (uint256)
  ```

  Returns how many tokens a user has allowed another user to transfer on its behalf.

**Parameters**
* `owner` (*address*) - The user who has given the allowance.
* `spender` (*address*) - The user who was given the allowance.

**Returns**
* `[0]` (*uint256*) - The amount of tokens `spender` can transfer on `owner`'s behalf.
#### transfer

  ```solidity
  function transfer(address to, uint256 amount) external returns (bool)
  ```

  Transfer tokens from one address to another.

**Parameters**
* `to` (*address*) - The address that will receive the tokens.
* `amount` (*uint256*) - The amount of tokens to be transferred.

**Returns**
* `[0]` (*bool*) - A boolean which is true if the operation succeeded.
#### approve

  ```solidity
  function approve(address spender, uint256 amount) external returns (bool)
  ```

  Allows users to provide allowance to other users so that they can transfer tokens on their behalf.

**Parameters**
* `spender` (*address*) - The address that is receiving the allowance.
* `amount` (*uint256*) - The amount of tokens that are being added to the allowance.

**Returns**
* `[0]` (*bool*) - A boolean which is true if the operation succeeded.
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

**Parameters**
* `from` (*address*) - The address that owns the tokens that are being transferred.
* `to` (*address*) - The address that will receive the tokens.
* `amount` (*uint256*) - The number of tokens to transfer.

**Returns**
* `[0]` (*bool*) - A boolean which is true if the operation succeeded.

#### Transfer

  ```solidity
  event Transfer(address from, address to, uint256 amount)
  ```

  Emitted when tokens have been transferred.

**Parameters**
* `from` (*address*) - The address that originally owned the tokens.
* `to` (*address*) - The address that received the tokens.
* `amount` (*uint256*) - The number of tokens that were transferred.

#### Approval

  ```solidity
  event Approval(address owner, address spender, uint256 amount)
  ```

  Emitted when a user has provided allowance to another user for transferring tokens on its behalf.

**Parameters**
* `owner` (*address*) - The address that is providing the allowance.
* `spender` (*address*) - The address that received the allowance.
* `amount` (*uint256*) - The number of tokens that were added to `spender`'s allowance.

### Vault Module

#### delegateCollateral

  ```solidity
  function delegateCollateral(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, uint256 leverage) external
  ```

  Updates an account's delegated collateral amount for the specified pool and collateral type pair.

**Parameters**
* `accountId` (*uint128*) - The id of the account associated with the position that will be updated.
* `poolId` (*uint128*) - The id of the pool associated with the position.
* `collateralType` (*address*) - The address of the collateral used in the position.
* `amount` (*uint256*) - The new amount of collateral delegated in the position, denominated with 18 decimals of precision.
* `leverage` (*uint256*) - The new leverage amount used in the position, denominated with 18 decimals of precision. Requirements: - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DELEGATE` permission. - If increasing the amount delegated, it must not exceed the available collateral (`getAccountAvailableCollateral`) associated with the account. - If decreasing the amount delegated, the liquidity position must have a collateralization ratio greater than the target collateralization ratio for the corresponding collateral type. Emits a {DelegationUpdated} event.

#### getPositionCollateralRatio

  ```solidity
  function getPositionCollateralRatio(uint128 accountId, uint128 poolId, address collateralType) external returns (uint256 ratioD18)
  ```

  Returns the collateralization ratio of the specified liquidity position. If debt is negative, this function will return 0.

  Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose collateralization ratio is being queried.
* `poolId` (*uint128*) - The id of the pool in which the account's position is held.
* `collateralType` (*address*) - The address of the collateral used in the queried position.

**Returns**
* `ratioD18` (*uint256*) - The collateralization ratio of the position (collateral / debt), denominated with 18 decimals of precision.
#### getPositionDebt

  ```solidity
  function getPositionDebt(uint128 accountId, uint128 poolId, address collateralType) external returns (int256 debtD18)
  ```

  Returns the debt of the specified liquidity position. Credit is expressed as negative debt.

  This is not a view function, and actually updates the entire debt distribution chain.
Call this function using `callStatic` to treat it as a view function.

**Parameters**
* `accountId` (*uint128*) - The id of the account being queried.
* `poolId` (*uint128*) - The id of the pool in which the account's position is held.
* `collateralType` (*address*) - The address of the collateral used in the queried position.

**Returns**
* `debtD18` (*int256*) - The amount of debt held by the position, denominated with 18 decimals of precision.
#### getPositionCollateral

  ```solidity
  function getPositionCollateral(uint128 accountId, uint128 poolId, address collateralType) external view returns (uint256 collateralAmountD18, uint256 collateralValueD18)
  ```

  Returns the amount and value of the collateral associated with the specified liquidity position.

  Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType.

**Parameters**
* `accountId` (*uint128*) - The id of the account being queried.
* `poolId` (*uint128*) - The id of the pool in which the account's position is held.
* `collateralType` (*address*) - The address of the collateral used in the queried position.

**Returns**
* `collateralAmountD18` (*uint256*) - The amount of collateral used in the position, denominated with 18 decimals of precision.
* `collateralValueD18` (*uint256*) - The value of collateral used in the position, denominated with 18 decimals of precision.
#### getPosition

  ```solidity
  function getPosition(uint128 accountId, uint128 poolId, address collateralType) external returns (uint256 collateralAmountD18, uint256 collateralValueD18, int256 debtD18, uint256 collateralizationRatioD18)
  ```

  Returns all information pertaining to a specified liquidity position in the vault module.

**Parameters**
* `accountId` (*uint128*) - The id of the account being queried.
* `poolId` (*uint128*) - The id of the pool in which the account's position is held.
* `collateralType` (*address*) - The address of the collateral used in the queried position.

**Returns**
* `collateralAmountD18` (*uint256*) - The amount of collateral used in the position, denominated with 18 decimals of precision.
* `collateralValueD18` (*uint256*) - The value of the collateral used in the position, denominated with 18 decimals of precision.
* `debtD18` (*int256*) - The amount of debt held in the position, denominated with 18 decimals of precision.
* `collateralizationRatioD18` (*uint256*) - The collateralization ratio of the position (collateral / debt), denominated with 18 decimals of precision.
#### getVaultDebt

  ```solidity
  function getVaultDebt(uint128 poolId, address collateralType) external returns (int256 debtD18)
  ```

  Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.

  This is not a view function, and actually updates the entire debt distribution chain.
Call this function using `callStatic` to treat it as a view function.

**Parameters**
* `poolId` (*uint128*) - The id of the pool that owns the vault whose debt is being queried.
* `collateralType` (*address*) - The address of the collateral of the associated vault.

**Returns**
* `debtD18` (*int256*) - The overall debt of the vault, denominated with 18 decimals of precision.
#### getVaultCollateral

  ```solidity
  function getVaultCollateral(uint128 poolId, address collateralType) external returns (uint256 collateralAmountD18, uint256 collateralValueD18)
  ```

  Returns the amount and value of the collateral held by the vault.

  Call this function using `callStatic` to treat it as a view function.
collateralAmount is represented as an integer with 18 decimals.
collateralValue is represented as an integer with the number of decimals specified by the collateralType.

**Parameters**
* `poolId` (*uint128*) - The id of the pool that owns the vault whose collateral is being queried.
* `collateralType` (*address*) - The address of the collateral of the associated vault.

**Returns**
* `collateralAmountD18` (*uint256*) - The collateral amount of the vault, denominated with 18 decimals of precision.
* `collateralValueD18` (*uint256*) - The collateral value of the vault, denominated with 18 decimals of precision.
#### getVaultCollateralRatio

  ```solidity
  function getVaultCollateralRatio(uint128 poolId, address collateralType) external returns (uint256 ratioD18)
  ```

  Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.

  Call this function using `callStatic` to treat it as a view function.
The return value is a percentage with 18 decimals places.

**Parameters**
* `poolId` (*uint128*) - The id of the pool that owns the vault whose collateralization ratio is being queried.
* `collateralType` (*address*) - The address of the collateral of the associated vault.

**Returns**
* `ratioD18` (*uint256*) - The collateralization ratio of the vault, denominated with 18 decimals of precision.

#### DelegationUpdated

  ```solidity
  event DelegationUpdated(uint128 accountId, uint128 poolId, address collateralType, uint256 amount, uint256 leverage, address sender)
  ```

  Emitted when {sender} updates the delegation of collateral in the specified liquidity position.

**Parameters**
* `accountId` (*uint128*) - The id of the account whose position was updated.
* `poolId` (*uint128*) - The id of the pool in which the position was updated.
* `collateralType` (*address*) - The address of the collateral associated to the position.
* `amount` (*uint256*) - The new amount of the position, denominated with 18 decimals of precision.
* `leverage` (*uint256*) - The new leverage value of the position, denominated with 18 decimals of precision.
* `sender` (*address*) - The address that triggered the update of the position.

## Spot Market

- [Back to TOC](#smart-contracts)

### Async Order Configuration Module

#### addSettlementStrategy

  ```solidity
  function addSettlementStrategy(uint128 synthMarketId, struct SettlementStrategy.Data strategy) external returns (uint256 strategyId)
  ```

  Adds new settlement strategy to the specified market id.

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market to associate the strategy with.
* `strategy` (*struct SettlementStrategy.Data*) - Settlement strategy data. see SettlementStrategy.Data struct.

**Returns**
* `strategyId` (*uint256*) - newly created settlement strategy id.
#### setSettlementStrategyEnabled

  ```solidity
  function setSettlementStrategyEnabled(uint128 synthMarketId, uint256 strategyId, bool enabled) external
  ```

  Sets the strategy to enabled or disabled.

  when disabled, the strategy will be invalid for committing of new async orders.

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market associated with the strategy.
* `strategyId` (*uint256*) - id of the strategy.
* `enabled` (*bool*) - set enabled/disabled.

#### getSettlementStrategy

  ```solidity
  function getSettlementStrategy(uint128 marketId, uint256 strategyId) external view returns (struct SettlementStrategy.Data settlementStrategy)
  ```

  Returns the settlement strategy data for given market/strategy id.

**Parameters**
* `marketId` (*uint128*) - Id of the market associated with the strategy.
* `strategyId` (*uint256*) - id of the strategy.

**Returns**
* `settlementStrategy` (*struct SettlementStrategy.Data*) - 

#### SettlementStrategyAdded

  ```solidity
  event SettlementStrategyAdded(uint128 synthMarketId, uint256 strategyId)
  ```

  Gets fired when new settlement strategy is added.

**Parameters**
* `synthMarketId` (*uint128*) - adds settlement strategy to this specific market.
* `strategyId` (*uint256*) - the newly created settlement strategy id.

#### SettlementStrategyUpdated

  ```solidity
  event SettlementStrategyUpdated(uint128 synthMarketId, uint256 strategyId, bool enabled)
  ```

  Gets fired when settlement strategy is enabled/disabled.

  currently only enabled/disabled flag can be updated.

**Parameters**
* `synthMarketId` (*uint128*) - adds settlement strategy to this specific market.
* `strategyId` (*uint256*) - id of the strategy.
* `enabled` (*bool*) - true/false.

### Async Order Module

#### commitOrder

  ```solidity
  function commitOrder(uint128 marketId, enum Transaction.Type orderType, uint256 amountProvided, uint256 settlementStrategyId, uint256 minimumSettlementAmount, address referrer) external returns (struct AsyncOrderClaim.Data asyncOrderClaim)
  ```

  Commit an async order via this function

  commitment transfers the amountProvided into the contract and escrows the funds until settlement.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `orderType` (*enum Transaction.Type*) - Should send either 2 or 3 which correlates to the transaction type enum defined in Transaction.Type.
* `amountProvided` (*uint256*) - amount of value provided by the user for trade. Should have enough allowance.
* `settlementStrategyId` (*uint256*) - id of the settlement strategy used for trade.
* `minimumSettlementAmount` (*uint256*) - minimum amount of value returned to trader after fees.
* `referrer` (*address*) - Optional address of the referrer, for fee share

**Returns**
* `asyncOrderClaim` (*struct AsyncOrderClaim.Data*) - claim details (see AsyncOrderClaim.Data struct).
#### cancelOrder

  ```solidity
  function cancelOrder(uint128 marketId, uint128 asyncOrderId) external
  ```

  Cancel an async order via this function

  cancellation transfers the amountProvided back to the trader without any fee collection
cancellation can only happen after the settlement time has passed
needs to satisfy commitmentTime + settlementDelay + settlementDuration < block.timestamp

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `asyncOrderId` (*uint128*) - id of the async order created during commitment.

#### getAsyncOrderClaim

  ```solidity
  function getAsyncOrderClaim(uint128 marketId, uint128 asyncOrderId) external view returns (struct AsyncOrderClaim.Data asyncOrderClaim)
  ```

  Get async order claim details

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `asyncOrderId` (*uint128*) - id of the async order created during commitment.

**Returns**
* `asyncOrderClaim` (*struct AsyncOrderClaim.Data*) - claim details (see AsyncOrderClaim.Data struct).

#### OrderCommitted

  ```solidity
  event OrderCommitted(uint128 marketId, enum Transaction.Type orderType, uint256 amountProvided, uint128 asyncOrderId, address sender, address referrer)
  ```

  Gets fired when a new order is committed.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `orderType` (*enum Transaction.Type*) - Should send either 2 or 3 which correlates to the transaction type enum defined in Transaction.Type.
* `amountProvided` (*uint256*) - amount of value provided by the user for trade.
* `asyncOrderId` (*uint128*) - id of the async order created (used for settlements).
* `sender` (*address*) - trader address.
* `referrer` (*address*) - Optional address of the referrer, for fee share

#### OrderCancelled

  ```solidity
  event OrderCancelled(uint128 marketId, uint128 asyncOrderId, struct AsyncOrderClaim.Data asyncOrderClaim, address sender)
  ```

  Gets fired when an order is cancelled.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `asyncOrderId` (*uint128*) - id of the async order.
* `asyncOrderClaim` (*struct AsyncOrderClaim.Data*) - claim details (see AsyncOrderClaim.Data struct).
* `sender` (*address*) - trader address and also the receiver of the funds.

### Async Order Settlement Module

#### settleOrder

  ```solidity
  function settleOrder(uint128 marketId, uint128 asyncOrderId) external returns (uint256 finalOrderAmount, struct OrderFees.Data)
  ```

  Settle already created async order via this function

  if the strategy is onchain, the settlement is done similar to an atomic buy except with settlement time
if the strategy is offchain, this function will revert with OffchainLookup error and the client should perform offchain lookup and call the callback specified see: EIP-3668

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `asyncOrderId` (*uint128*) - id of the async order created during commitment.

**Returns**
* `finalOrderAmount` (*uint256*) - amount returned to trader after fees.
* `[1]` (*struct OrderFees.Data*) - OrderFees.Data breakdown of all the fees incurred for the transaction.
#### settlePythOrder

  ```solidity
  function settlePythOrder(bytes result, bytes extraData) external payable returns (uint256 finalOrderAmount, struct OrderFees.Data fees)
  ```

  Callback function for Pyth settlement strategy

  This is the selector specified as callback when settlement strategy is pyth offchain.
The data returned from the offchain lookup should be sent as "result"
The extraData is the same as the one sent during the offchain lookup revert error. It is used to retrieve the commitment claim.
this function expects ETH that is passed through to the Pyth contract for the fee it's charging.
To determine the fee, the client should first call getUpdateFee() from Pyth's verifier contract.

**Parameters**
* `result` (*bytes*) - result returned from the offchain lookup.
* `extraData` (*bytes*) - extra data sent during the offchain lookup revert error.

**Returns**
* `finalOrderAmount` (*uint256*) - amount returned to trader after fees.
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction.

#### OrderSettled

  ```solidity
  event OrderSettled(uint128 marketId, uint128 asyncOrderId, uint256 finalOrderAmount, struct OrderFees.Data fees, uint256 collectedFees, address settler, uint256 price, enum Transaction.Type orderType)
  ```

  Gets fired when an order is settled.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `asyncOrderId` (*uint128*) - id of the async order.
* `finalOrderAmount` (*uint256*) - amount returned to trader after fees.
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction.
* `collectedFees` (*uint256*) - fees collected by the configured fee collector.
* `settler` (*address*) - address that settled the order.
* `price` (*uint256*) - 
* `orderType` (*enum Transaction.Type*) - 

### Atomic Order Module

#### buyExactIn

  ```solidity
  function buyExactIn(uint128 synthMarketId, uint256 amountUsd, uint256 minAmountReceived, address referrer) external returns (uint256 synthAmount, struct OrderFees.Data fees)
  ```

  Initiates a buy trade returning synth for the specified amountUsd.

  Transfers the specified amountUsd, collects fees through configured fee collector, returns synth to the trader.
Leftover fees not collected get deposited into the market manager to improve market PnL.
Uses the buyFeedId configured for the market.

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market used for the trade.
* `amountUsd` (*uint256*) - Amount of snxUSD trader is providing allowance for the trade.
* `minAmountReceived` (*uint256*) - Min Amount of synth is expected the trader to receive otherwise the transaction will revert.
* `referrer` (*address*) - Optional address of the referrer, for fee share

**Returns**
* `synthAmount` (*uint256*) - Synth received on the trade based on amount provided by trader.
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction.
#### buy

  ```solidity
  function buy(uint128 marketId, uint256 usdAmount, uint256 minAmountReceived, address referrer) external returns (uint256 synthAmount, struct OrderFees.Data fees)
  ```

  alias for buyExactIn

**Parameters**
* `marketId` (*uint128*) - (see buyExactIn)
* `usdAmount` (*uint256*) - (see buyExactIn)
* `minAmountReceived` (*uint256*) - (see buyExactIn)
* `referrer` (*address*) - (see buyExactIn)

**Returns**
* `synthAmount` (*uint256*) - (see buyExactIn)
* `fees` (*struct OrderFees.Data*) - (see buyExactIn)
#### buyExactOut

  ```solidity
  function buyExactOut(uint128 synthMarketId, uint256 synthAmount, uint256 maxUsdAmount, address referrer) external returns (uint256 usdAmountCharged, struct OrderFees.Data fees)
  ```

  user provides the synth amount they'd like to buy, and the function charges the USD amount which includes fees

  the inverse of buyExactIn

**Parameters**
* `synthMarketId` (*uint128*) - market id value
* `synthAmount` (*uint256*) - the amount of synth the trader wants to buy
* `maxUsdAmount` (*uint256*) - max amount the trader is willing to pay for the specified synth
* `referrer` (*address*) - optional address of the referrer, for fee share

**Returns**
* `usdAmountCharged` (*uint256*) - amount of USD charged for the trade
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction
#### quoteBuyExactIn

  ```solidity
  function quoteBuyExactIn(uint128 synthMarketId, uint256 usdAmount) external view returns (uint256 synthAmount, struct OrderFees.Data fees)
  ```

  quote for buyExactIn.  same parameters and return values as buyExactIn

**Parameters**
* `synthMarketId` (*uint128*) - market id value
* `usdAmount` (*uint256*) - amount of USD to use for the trade

**Returns**
* `synthAmount` (*uint256*) - return amount of synth given the USD amount - fees
* `fees` (*struct OrderFees.Data*) - breakdown of all the quoted fees for the buy txn
#### quoteBuyExactOut

  ```solidity
  function quoteBuyExactOut(uint128 synthMarketId, uint256 synthAmount) external view returns (uint256 usdAmountCharged, struct OrderFees.Data)
  ```

  quote for buyExactOut.  same parameters and return values as buyExactOut

**Parameters**
* `synthMarketId` (*uint128*) - market id value
* `synthAmount` (*uint256*) - amount of synth requested

**Returns**
* `usdAmountCharged` (*uint256*) - USD amount charged for the synth requested - fees
* `[1]` (*struct OrderFees.Data*) - fees  breakdown of all the quoted fees for the buy txn
#### sellExactIn

  ```solidity
  function sellExactIn(uint128 synthMarketId, uint256 sellAmount, uint256 minAmountReceived, address referrer) external returns (uint256 returnAmount, struct OrderFees.Data fees)
  ```

  Initiates a sell trade returning snxUSD for the specified amount of synth (sellAmount)

  Transfers the specified synth, collects fees through configured fee collector, returns snxUSD to the trader.
Leftover fees not collected get deposited into the market manager to improve market PnL.

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market used for the trade.
* `sellAmount` (*uint256*) - Amount of synth provided by trader for trade into snxUSD.
* `minAmountReceived` (*uint256*) - Min Amount of snxUSD trader expects to receive for the trade
* `referrer` (*address*) - Optional address of the referrer, for fee share

**Returns**
* `returnAmount` (*uint256*) - Amount of snxUSD returned to user
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction.
#### sellExactOut

  ```solidity
  function sellExactOut(uint128 marketId, uint256 usdAmount, uint256 maxSynthAmount, address referrer) external returns (uint256 synthToBurn, struct OrderFees.Data fees)
  ```

  initiates a trade where trader specifies USD amount they'd like to receive

  the inverse of sellExactIn

**Parameters**
* `marketId` (*uint128*) - synth market id
* `usdAmount` (*uint256*) - amount of USD trader wants to receive
* `maxSynthAmount` (*uint256*) - max amount of synth trader is willing to use to receive the specified USD amount
* `referrer` (*address*) - optional address of the referrer, for fee share

**Returns**
* `synthToBurn` (*uint256*) - amount of synth charged for the specified usd amount
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction
#### sell

  ```solidity
  function sell(uint128 marketId, uint256 synthAmount, uint256 minUsdAmount, address referrer) external returns (uint256 usdAmountReceived, struct OrderFees.Data fees)
  ```

  alias for sellExactIn

**Parameters**
* `marketId` (*uint128*) - (see sellExactIn)
* `synthAmount` (*uint256*) - (see sellExactIn)
* `minUsdAmount` (*uint256*) - (see sellExactIn)
* `referrer` (*address*) - (see sellExactIn)

**Returns**
* `usdAmountReceived` (*uint256*) - (see sellExactIn)
* `fees` (*struct OrderFees.Data*) - (see sellExactIn)
#### quoteSellExactIn

  ```solidity
  function quoteSellExactIn(uint128 marketId, uint256 synthAmount) external view returns (uint256 returnAmount, struct OrderFees.Data fees)
  ```

  quote for sellExactIn

  returns expected USD amount trader would receive for the specified synth amount

**Parameters**
* `marketId` (*uint128*) - synth market id
* `synthAmount` (*uint256*) - synth amount trader is providing for the trade

**Returns**
* `returnAmount` (*uint256*) - amount of USD expected back
* `fees` (*struct OrderFees.Data*) - breakdown of all the quoted fees for the txn
#### quoteSellExactOut

  ```solidity
  function quoteSellExactOut(uint128 marketId, uint256 usdAmount) external view returns (uint256 synthToBurn, struct OrderFees.Data fees)
  ```

  quote for sellExactOut

  returns expected synth amount expected from trader for the requested USD amount

**Parameters**
* `marketId` (*uint128*) - synth market id
* `usdAmount` (*uint256*) - USD amount trader wants to receive

**Returns**
* `synthToBurn` (*uint256*) - amount of synth expected from trader
* `fees` (*struct OrderFees.Data*) - breakdown of all the quoted fees for the txn

#### SynthBought

  ```solidity
  event SynthBought(uint256 synthMarketId, uint256 synthReturned, struct OrderFees.Data fees, uint256 collectedFees, address referrer, uint256 price)
  ```

  Gets fired when buy trade is complete

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market used for the trade.
* `synthReturned` (*uint256*) - Synth received on the trade based on amount provided by trader.
* `fees` (*struct OrderFees.Data*) - breakdown of all fees incurred for transaction.
* `collectedFees` (*uint256*) - Fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).
* `referrer` (*address*) - Optional address of the referrer, for fee share
* `price` (*uint256*) - 

#### SynthSold

  ```solidity
  event SynthSold(uint256 synthMarketId, uint256 amountReturned, struct OrderFees.Data fees, uint256 collectedFees, address referrer, uint256 price)
  ```

  Gets fired when sell trade is complete

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market used for the trade.
* `amountReturned` (*uint256*) - Amount of snxUSD returned to user based on synth provided by trader.
* `fees` (*struct OrderFees.Data*) - breakdown of all fees incurred for transaction.
* `collectedFees` (*uint256*) - Fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).
* `referrer` (*address*) - Optional address of the referrer, for fee share
* `price` (*uint256*) - 

### Market Configuration Module

#### getMarketFees

  ```solidity
  function getMarketFees(uint128 synthMarketId) external returns (uint256 atomicFixedFee, uint256 asyncFixedFee, int256 wrapFee, int256 unwrapFee)
  ```

  gets the atomic fixed fee for a given market

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the fee applies to.

**Returns**
* `atomicFixedFee` (*uint256*) - fixed fee amount represented in bips with 18 decimals.
* `asyncFixedFee` (*uint256*) - fixed fee amount represented in bips with 18 decimals.
* `wrapFee` (*int256*) - wrapping fee in %, 18 decimals. Can be negative.
* `unwrapFee` (*int256*) - unwrapping fee in %, 18 decimals. Can be negative.
#### setAtomicFixedFee

  ```solidity
  function setAtomicFixedFee(uint128 synthMarketId, uint256 atomicFixedFee) external
  ```

  sets the atomic fixed fee for a given market

  only marketOwner can set the fee

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the fee applies to.
* `atomicFixedFee` (*uint256*) - fixed fee amount represented in bips with 18 decimals.

#### setAsyncFixedFee

  ```solidity
  function setAsyncFixedFee(uint128 synthMarketId, uint256 asyncFixedFee) external
  ```

  sets the async fixed fee for a given market

  only marketOwner can set the fee

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the fee applies to.
* `asyncFixedFee` (*uint256*) - fixed fee amount represented in bips with 18 decimals.

#### setMarketSkewScale

  ```solidity
  function setMarketSkewScale(uint128 synthMarketId, uint256 skewScale) external
  ```

  sets the skew scale for a given market

  only marketOwner can set the skew scale

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the skew scale applies to.
* `skewScale` (*uint256*) - max amount of synth which makes the skew 100%. the fee is derived as a % of the max value.  100% premium means outstanding synth == skewScale.

#### getMarketSkewScale

  ```solidity
  function getMarketSkewScale(uint128 synthMarketId) external returns (uint256 skewScale)
  ```

  gets the skew scale for a given market

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the skew scale applies to.

**Returns**
* `skewScale` (*uint256*) - max amount of synth which makes the skew 100%. the fee is derived as a % of the max value.  100% premium means outstanding synth == skewScale.
#### setMarketUtilizationFees

  ```solidity
  function setMarketUtilizationFees(uint128 synthMarketId, uint256 utilizationFeeRate) external
  ```

  sets the market utilization fee for a given market

  only marketOwner can set the fee
100% utilization means the fee is 0.  120% utilization means the fee is 20% * this fee rate (in bips).

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the utilization fee applies to.
* `utilizationFeeRate` (*uint256*) - the rate is represented in bips with 18 decimals and is the rate at which fee increases based on the % above 100% utilization of the delegated collateral for the market.

#### getMarketUtilizationFees

  ```solidity
  function getMarketUtilizationFees(uint128 synthMarketId) external returns (uint256 utilizationFeeRate)
  ```

  gets the market utilization fee for a given market

  100% utilization means the fee is 0.  120% utilization means the fee is 20% * this fee rate (in bips).

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the utilization fee applies to.

**Returns**
* `utilizationFeeRate` (*uint256*) - the rate is represented in bips with 18 decimals and is the rate at which fee increases based on the % above 100% utilization of the delegated collateral for the market.
#### setCollateralLeverage

  ```solidity
  function setCollateralLeverage(uint128 synthMarketId, uint256 collateralLeverage) external
  ```

  sets the collateral leverage for a given market

  only marketOwner can set the leverage
this leverage value is a value applied to delegated collateral which is compared to outstanding synth to determine utilization of market, and locked amounts

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the collateral leverage applies to.
* `collateralLeverage` (*uint256*) - the leverage is represented as % with 18 decimals. 1 = 1x leverage

#### getCollateralLeverage

  ```solidity
  function getCollateralLeverage(uint128 synthMarketId) external returns (uint256 collateralLeverage)
  ```

  gets the collateral leverage for a given market

  this leverage value is a value applied to delegated collateral which is compared to outstanding synth to determine utilization of market, and locked amounts

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the collateral leverage applies to.

**Returns**
* `collateralLeverage` (*uint256*) - the leverage is represented as % with 18 decimals. 1 = 1x leverage
#### setCustomTransactorFees

  ```solidity
  function setCustomTransactorFees(uint128 synthMarketId, address transactor, uint256 fixedFeeAmount) external
  ```

  sets the fixed fee for a given market and transactor

  overrides both the atomic and async fixed fees
only marketOwner can set the fee
especially useful for direct integrations where configured traders get a discount

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the custom transactor fee applies to.
* `transactor` (*address*) - address of the trader getting discounted fees.
* `fixedFeeAmount` (*uint256*) - the fixed fee applying to the provided transactor.

#### getCustomTransactorFees

  ```solidity
  function getCustomTransactorFees(uint128 synthMarketId, address transactor) external returns (uint256 fixedFeeAmount)
  ```

  gets the fixed fee for a given market and transactor

  overrides both the atomic and async fixed fees
especially useful for direct integrations where configured traders get a discount

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the custom transactor fee applies to.
* `transactor` (*address*) - address of the trader getting discounted fees.

**Returns**
* `fixedFeeAmount` (*uint256*) - the fixed fee applying to the provided transactor.
#### setFeeCollector

  ```solidity
  function setFeeCollector(uint128 synthMarketId, address feeCollector) external
  ```

  sets a custom fee collector for a given market

  only marketOwner can set the fee collector
a use case here would be if the market owner wants to collect the fees via this contract and distribute via rewards distributor to SNX holders for example.
if fee collector is not set, the fees are deposited into the market manager.

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the fee collector applies to.
* `feeCollector` (*address*) - address of the fee collector inheriting the IFeeCollector interface.

#### getFeeCollector

  ```solidity
  function getFeeCollector(uint128 synthMarketId) external returns (address feeCollector)
  ```

  gets a custom fee collector for a given market

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the fee collector applies to.

**Returns**
* `feeCollector` (*address*) - address of the fee collector inheriting the IFeeCollector interface.
#### setWrapperFees

  ```solidity
  function setWrapperFees(uint128 synthMarketId, int256 wrapFee, int256 unwrapFee) external
  ```

  sets wrapper related fees.

  only marketOwner can set the wrapper fees
fees can be negative.  this is a way to unwind the wrapper if needed by providing incentives.

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the wrapper fees apply to.
* `wrapFee` (*int256*) - wrapping fee in %, 18 decimals. Can be negative.
* `unwrapFee` (*int256*) - unwrapping fee in %, 18 decimals. Can be negative.

#### updateReferrerShare

  ```solidity
  function updateReferrerShare(uint128 marketId, address referrer, uint256 sharePercentage) external
  ```

  Update the referral share percentage for a given market

**Parameters**
* `marketId` (*uint128*) - id of the market
* `referrer` (*address*) - The address of the referrer
* `sharePercentage` (*uint256*) - The new share percentage for the referrer

#### getReferrerShare

  ```solidity
  function getReferrerShare(uint128 marketId, address referrer) external returns (uint256 sharePercentage)
  ```

  get the referral share percentage for a given market

**Parameters**
* `marketId` (*uint128*) - id of the market
* `referrer` (*address*) - The address of the referrer

**Returns**
* `sharePercentage` (*uint256*) - The new share percentage for the referrer

#### MarketUtilizationFeesSet

  ```solidity
  event MarketUtilizationFeesSet(uint256 synthMarketId, uint256 utilizationFeeRate)
  ```

  emitted when market utilization fees are set for specified market

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `utilizationFeeRate` (*uint256*) - utilization fee rate value

#### MarketSkewScaleSet

  ```solidity
  event MarketSkewScaleSet(uint256 synthMarketId, uint256 skewScale)
  ```

  emitted when the skew scale is set for a market

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `skewScale` (*uint256*) - skew scale value

#### CollateralLeverageSet

  ```solidity
  event CollateralLeverageSet(uint256 synthMarketId, uint256 collateralLeverage)
  ```

  emitted when the collateral leverage is set for a market

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `collateralLeverage` (*uint256*) - leverage value

#### AtomicFixedFeeSet

  ```solidity
  event AtomicFixedFeeSet(uint256 synthMarketId, uint256 atomicFixedFee)
  ```

  emitted when the fixed fee for atomic orders is set.

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `atomicFixedFee` (*uint256*) - fee value

#### AsyncFixedFeeSet

  ```solidity
  event AsyncFixedFeeSet(uint256 synthMarketId, uint256 asyncFixedFee)
  ```

  emitted when the fixed fee for async orders is set.

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `asyncFixedFee` (*uint256*) - fee value

#### TransactorFixedFeeSet

  ```solidity
  event TransactorFixedFeeSet(uint256 synthMarketId, address transactor, uint256 fixedFeeAmount)
  ```

  emitted when the fixed fee is set for a given transactor

  this overrides the async/atomic fixed fees for a given transactor

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market to set the fees for.
* `transactor` (*address*) - fixed fee for the transactor (overrides the global fixed fee)
* `fixedFeeAmount` (*uint256*) - the fixed fee for the corresponding market, and transactor

#### FeeCollectorSet

  ```solidity
  event FeeCollectorSet(uint256 synthMarketId, address feeCollector)
  ```

  emitted when custom fee collector is set for a given market

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market to set the collector for.
* `feeCollector` (*address*) - the address of the fee collector to set.

#### WrapperFeesSet

  ```solidity
  event WrapperFeesSet(uint256 synthMarketId, int256 wrapFee, int256 unwrapFee)
  ```

  emitted when wrapper fees are set for a given market

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market to set the wrapper fees.
* `wrapFee` (*int256*) - wrapping fee in %, 18 decimals. Can be negative.
* `unwrapFee` (*int256*) - unwrapping fee in %, 18 decimals. Can be negative.

#### ReferrerShareUpdated

  ```solidity
  event ReferrerShareUpdated(uint128 marketId, address referrer, uint256 sharePercentage)
  ```

  Emitted when the share percentage for a referrer address has been updated.

**Parameters**
* `marketId` (*uint128*) - Id of the market
* `referrer` (*address*) - The address of the referrer
* `sharePercentage` (*uint256*) - The new share percentage for the referrer

### Spot Market Factory Module

#### setSynthetix

  ```solidity
  function setSynthetix(contract ISynthetixSystem synthetix) external
  ```

  Sets the v3 synthetix core system.

  Pulls in the USDToken and oracle manager from the synthetix core system and sets those appropriately.

**Parameters**
* `synthetix` (*contract ISynthetixSystem*) - synthetix v3 core system address

#### setSynthImplementation

  ```solidity
  function setSynthImplementation(address synthImplementation) external
  ```

  When a new synth is created, this is the erc20 implementation that is used.

**Parameters**
* `synthImplementation` (*address*) - erc20 implementation address

#### createSynth

  ```solidity
  function createSynth(string tokenName, string tokenSymbol, address synthOwner) external returns (uint128 synthMarketId)
  ```

  Creates a new synth market with synthetix v3 core system via market manager

  The synth is created using the initial synth implementation and creates a proxy for future upgrades of the synth implementation.
Sets up the market owner who can update configuration for the synth.

**Parameters**
* `tokenName` (*string*) - name of synth (i.e Synthetix ETH)
* `tokenSymbol` (*string*) - symbol of synth (i.e snxETH)
* `synthOwner` (*address*) - owner of the market that's created.

**Returns**
* `synthMarketId` (*uint128*) - id of the synth market that was created
#### getSynth

  ```solidity
  function getSynth(uint128 marketId) external view returns (address synthAddress)
  ```

  Get the proxy address of the synth for the provided marketId

  Uses associated systems module to retrieve the token address.

**Parameters**
* `marketId` (*uint128*) - id of the market

**Returns**
* `synthAddress` (*address*) - address of the proxy for the synth
#### getSynthImpl

  ```solidity
  function getSynthImpl(uint128 marketId) external view returns (address implAddress)
  ```

  Get the implementation address of the synth for the provided marketId.
This address should not be used directly--use `getSynth` instead

  Uses associated systems module to retrieve the token address.

**Parameters**
* `marketId` (*uint128*) - id of the market

**Returns**
* `implAddress` (*address*) - address of the proxy for the synth
#### updatePriceData

  ```solidity
  function updatePriceData(uint128 marketId, bytes32 buyFeedId, bytes32 sellFeedId) external
  ```

  Update the price data for a given market.

  Only the market owner can call this function.

**Parameters**
* `marketId` (*uint128*) - id of the market
* `buyFeedId` (*bytes32*) - the oracle manager buy feed node id
* `sellFeedId` (*bytes32*) - the oracle manager sell feed node id

#### upgradeSynthImpl

  ```solidity
  function upgradeSynthImpl(uint128 marketId) external
  ```

  upgrades the synth implementation to the current implementation for the specified market.
Anyone who is willing and able to spend the gas can call this method.

  The synth implementation is upgraded via the proxy.

**Parameters**
* `marketId` (*uint128*) - id of the market

#### setDecayRate

  ```solidity
  function setDecayRate(uint128 marketId, uint256 rate) external
  ```

  Allows market to adjust decay rate of the synth

**Parameters**
* `marketId` (*uint128*) - the market to update the synth decay rate for
* `rate` (*uint256*) - APY to decay of the synth to decay by, as a 18 decimal ratio

#### nominateMarketOwner

  ```solidity
  function nominateMarketOwner(uint128 synthMarketId, address newNominatedOwner) external
  ```

  Allows the current market owner to nominate a new owner.

  The nominated owner will have to call `acceptOwnership` in a separate transaction in order to finalize the action and become the new contract owner.

**Parameters**
* `synthMarketId` (*uint128*) - synth market id value
* `newNominatedOwner` (*address*) - The address that is to become nominated.

#### acceptMarketOwnership

  ```solidity
  function acceptMarketOwnership(uint128 synthMarketId) external
  ```

  Allows a nominated address to accept ownership of the market.

  Reverts if the caller is not nominated.

**Parameters**
* `synthMarketId` (*uint128*) - synth market id value

#### renounceMarketNomination

  ```solidity
  function renounceMarketNomination(uint128 synthMarketId) external
  ```

  Allows a nominated address to renounce ownership of the market.

  Reverts if the caller is not nominated.

**Parameters**
* `synthMarketId` (*uint128*) - synth market id value

#### getMarketOwner

  ```solidity
  function getMarketOwner(uint128 synthMarketId) external view returns (address)
  ```

  Returns market owner.

**Parameters**
* `synthMarketId` (*uint128*) - synth market id value

#### name

  ```solidity
  function name(uint128 marketId) external view returns (string)
  ```

  returns a human-readable name for a given market

#### reportedDebt

  ```solidity
  function reportedDebt(uint128 marketId) external view returns (uint256)
  ```

  returns amount of USD that the market would try to mint if everything was withdrawn

#### minimumCredit

  ```solidity
  function minimumCredit(uint128 marketId) external view returns (uint256)
  ```

  prevents reduction of available credit capacity by specifying this amount, for which withdrawals will be disallowed

#### supportsInterface

  ```solidity
  function supportsInterface(bytes4 interfaceID) external view returns (bool)
  ```

  Determines if the contract in question supports the specified interface.

**Parameters**
* `interfaceID` (*bytes4*) - XOR of all selectors in the contract.

**Returns**
* `[0]` (*bool*) - True if the contract supports the specified interface.

#### SynthetixSystemSet

  ```solidity
  event SynthetixSystemSet(address synthetix, address usdTokenAddress, address oracleManager)
  ```

  Gets fired when the synthetix is set

**Parameters**
* `synthetix` (*address*) - address of the synthetix core contract
* `usdTokenAddress` (*address*) - address of the USDToken contract
* `oracleManager` (*address*) - address of the Oracle Manager contract

#### SynthImplementationSet

  ```solidity
  event SynthImplementationSet(address synthImplementation)
  ```

  Gets fired when the synth implementation is set

**Parameters**
* `synthImplementation` (*address*) - address of the synth implementation

#### SynthRegistered

  ```solidity
  event SynthRegistered(uint256 synthMarketId)
  ```

  Gets fired when the synth is registered as a market.

**Parameters**
* `synthMarketId` (*uint256*) - Id of the synth market that was created

#### SynthImplementationUpgraded

  ```solidity
  event SynthImplementationUpgraded(uint256 synthMarketId, address proxy, address implementation)
  ```

  Gets fired when the synth's implementation is updated on the corresponding proxy.

**Parameters**
* `synthMarketId` (*uint256*) - 
* `proxy` (*address*) - the synth proxy servicing the latest implementation
* `implementation` (*address*) - the latest implementation of the synth

#### SynthPriceDataUpdated

  ```solidity
  event SynthPriceDataUpdated(uint256 synthMarketId, bytes32 buyFeedId, bytes32 sellFeedId)
  ```

  Gets fired when the market's price feeds are updated, compatible with oracle manager

**Parameters**
* `synthMarketId` (*uint256*) - 
* `buyFeedId` (*bytes32*) - the oracle manager feed id for the buy price
* `sellFeedId` (*bytes32*) - the oracle manager feed id for the sell price

#### DecayRateUpdated

  ```solidity
  event DecayRateUpdated(uint128 marketId, uint256 rate)
  ```

  Gets fired when the market's price feeds are updated, compatible with oracle manager

**Parameters**
* `marketId` (*uint128*) - Id of the synth market
* `rate` (*uint256*) - the new decay rate (1e16 means 1% decay per year)

#### MarketOwnerNominated

  ```solidity
  event MarketOwnerNominated(uint128 marketId, address newOwner)
  ```

  Emitted when an address has been nominated.

**Parameters**
* `marketId` (*uint128*) - id of the market
* `newOwner` (*address*) - The address that has been nominated.

#### MarketNominationRenounced

  ```solidity
  event MarketNominationRenounced(uint128 marketId, address nominee)
  ```

  Emitted when market nominee renounces nomination.

**Parameters**
* `marketId` (*uint128*) - id of the market
* `nominee` (*address*) - The address that has been nominated.

#### MarketOwnerChanged

  ```solidity
  event MarketOwnerChanged(uint128 marketId, address oldOwner, address newOwner)
  ```

  Emitted when the owner of the market has changed.

**Parameters**
* `marketId` (*uint128*) - id of the market
* `oldOwner` (*address*) - The previous owner of the market.
* `newOwner` (*address*) - The new owner of the market.

### Synth Token Module

#### setDecayRate

  ```solidity
  function setDecayRate(uint256 _rate) external
  ```

  Updates the decay rate for a year

**Parameters**
* `_rate` (*uint256*) - The decay rate with 18 decimals (1e16 means 1% decay per year).

#### decayRate

  ```solidity
  function decayRate() external returns (uint256)
  ```

  get decay rate for a year

#### advanceEpoch

  ```solidity
  function advanceEpoch() external returns (uint256)
  ```

  advance epoch manually in order to avoid precision loss

#### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns wether the token has been initialized.

**Returns**
* `[0]` (*bool*) - A boolean with the result of the query.
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

**Parameters**
* `to` (*address*) - The address to receive the newly minted tokens.
* `amount` (*uint256*) - The amount of tokens to mint.

#### burn

  ```solidity
  function burn(address from, uint256 amount) external
  ```

  Allows the owner to burn tokens.

**Parameters**
* `from` (*address*) - The address whose tokens will be burnt.
* `amount` (*uint256*) - The amount of tokens to burn.

#### setAllowance

  ```solidity
  function setAllowance(address from, address spender, uint256 amount) external
  ```

  Allows an address that holds tokens to provide allowance to another.

**Parameters**
* `from` (*address*) - The address that is providing allowance.
* `spender` (*address*) - The address that is given allowance.
* `amount` (*uint256*) - The amount of allowance being given.

#### name

  ```solidity
  function name() external view returns (string)
  ```

  Retrieves the name of the token, e.g. "Synthetix Network Token".

**Returns**
* `[0]` (*string*) - A string with the name of the token.
#### symbol

  ```solidity
  function symbol() external view returns (string)
  ```

  Retrieves the symbol of the token, e.g. "SNX".

**Returns**
* `[0]` (*string*) - A string with the symbol of the token.
#### decimals

  ```solidity
  function decimals() external view returns (uint8)
  ```

  Retrieves the number of decimals used by the token. The default is 18.

**Returns**
* `[0]` (*uint8*) - The number of decimals.
#### totalSupply

  ```solidity
  function totalSupply() external view returns (uint256)
  ```

  Returns the total number of tokens in circulation (minted - burnt).

**Returns**
* `[0]` (*uint256*) - The total number of tokens.
#### balanceOf

  ```solidity
  function balanceOf(address owner) external view returns (uint256)
  ```

  Returns the balance of a user.

**Parameters**
* `owner` (*address*) - The address whose balance is being retrieved.

**Returns**
* `[0]` (*uint256*) - The number of tokens owned by the user.
#### allowance

  ```solidity
  function allowance(address owner, address spender) external view returns (uint256)
  ```

  Returns how many tokens a user has allowed another user to transfer on its behalf.

**Parameters**
* `owner` (*address*) - The user who has given the allowance.
* `spender` (*address*) - The user who was given the allowance.

**Returns**
* `[0]` (*uint256*) - The amount of tokens `spender` can transfer on `owner`'s behalf.
#### transfer

  ```solidity
  function transfer(address to, uint256 amount) external returns (bool)
  ```

  Transfer tokens from one address to another.

**Parameters**
* `to` (*address*) - The address that will receive the tokens.
* `amount` (*uint256*) - The amount of tokens to be transferred.

**Returns**
* `[0]` (*bool*) - A boolean which is true if the operation succeeded.
#### approve

  ```solidity
  function approve(address spender, uint256 amount) external returns (bool)
  ```

  Allows users to provide allowance to other users so that they can transfer tokens on their behalf.

**Parameters**
* `spender` (*address*) - The address that is receiving the allowance.
* `amount` (*uint256*) - The amount of tokens that are being added to the allowance.

**Returns**
* `[0]` (*bool*) - A boolean which is true if the operation succeeded.
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

**Parameters**
* `from` (*address*) - The address that owns the tokens that are being transferred.
* `to` (*address*) - The address that will receive the tokens.
* `amount` (*uint256*) - The number of tokens to transfer.

**Returns**
* `[0]` (*bool*) - A boolean which is true if the operation succeeded.

#### Transfer

  ```solidity
  event Transfer(address from, address to, uint256 amount)
  ```

  Emitted when tokens have been transferred.

**Parameters**
* `from` (*address*) - The address that originally owned the tokens.
* `to` (*address*) - The address that received the tokens.
* `amount` (*uint256*) - The number of tokens that were transferred.

#### Approval

  ```solidity
  event Approval(address owner, address spender, uint256 amount)
  ```

  Emitted when a user has provided allowance to another user for transferring tokens on its behalf.

**Parameters**
* `owner` (*address*) - The address that is providing the allowance.
* `spender` (*address*) - The address that received the allowance.
* `amount` (*uint256*) - The number of tokens that were added to `spender`'s allowance.

### Wrapper Module

#### setWrapper

  ```solidity
  function setWrapper(uint128 marketId, address wrapCollateralType, uint256 maxWrappableAmount) external
  ```

  Used to set the wrapper supply cap for a given market and collateral type.

  If the supply cap is set to 0 or lower than the current outstanding supply, then the wrapper is disabled.
There is a synthetix v3 core system supply cap also set. If the current supply becomes higher than either the core system supply cap or the local market supply cap, wrapping will be disabled.

**Parameters**
* `marketId` (*uint128*) - Id of the market to enable wrapping for.
* `wrapCollateralType` (*address*) - The collateral being used to wrap the synth.
* `maxWrappableAmount` (*uint256*) - The maximum amount of collateral that can be wrapped.

#### wrap

  ```solidity
  function wrap(uint128 marketId, uint256 wrapAmount, uint256 minAmountReceived) external returns (uint256 amountToMint, struct OrderFees.Data fees)
  ```

  Wraps the specified amount and returns similar value of synth minus the fees.

  Fees are collected from the user by way of the contract returning less synth than specified amount of collateral.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `wrapAmount` (*uint256*) - Amount of collateral to wrap.  This amount gets deposited into the market collateral manager.
* `minAmountReceived` (*uint256*) - The minimum amount of synths the trader is expected to receive, otherwise the transaction will revert.

**Returns**
* `amountToMint` (*uint256*) - Amount of synth returned to user.
* `fees` (*struct OrderFees.Data*) - breakdown of all fees. in this case, only wrapper fees are returned.
#### unwrap

  ```solidity
  function unwrap(uint128 marketId, uint256 unwrapAmount, uint256 minAmountReceived) external returns (uint256 returnCollateralAmount, struct OrderFees.Data fees)
  ```

  Unwraps the synth and returns similar value of collateral minus the fees.

  Transfers the specified synth, collects fees through configured fee collector, returns collateral minus fees to trader.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `unwrapAmount` (*uint256*) - Amount of synth trader is unwrapping.
* `minAmountReceived` (*uint256*) - The minimum amount of collateral the trader is expected to receive, otherwise the transaction will revert.

**Returns**
* `returnCollateralAmount` (*uint256*) - Amount of collateral returned.
* `fees` (*struct OrderFees.Data*) - breakdown of all fees. in this case, only wrapper fees are returned.

#### WrapperSet

  ```solidity
  event WrapperSet(uint256 synthMarketId, address wrapCollateralType, uint256 maxWrappableAmount)
  ```

  Gets fired when wrapper supply is set for a given market, collateral type.

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market the wrapper is initialized for.
* `wrapCollateralType` (*address*) - the collateral used to wrap the synth.
* `maxWrappableAmount` (*uint256*) - the local supply cap for the wrapper.

#### SynthWrapped

  ```solidity
  event SynthWrapped(uint256 synthMarketId, uint256 amountWrapped, struct OrderFees.Data fees, uint256 feesCollected)
  ```

  Gets fired after user wraps synth

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market.
* `amountWrapped` (*uint256*) - amount of synth wrapped.
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction.
* `feesCollected` (*uint256*) - fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).

#### SynthUnwrapped

  ```solidity
  event SynthUnwrapped(uint256 synthMarketId, uint256 amountUnwrapped, struct OrderFees.Data fees, uint256 feesCollected)
  ```

  Gets fired after user unwraps synth

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market.
* `amountUnwrapped` (*uint256*) - amount of synth unwrapped.
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction.
* `feesCollected` (*uint256*) - fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).

## Perps Market

- [Back to TOC](#smart-contracts)

### Async Order Module

#### commitOrder

  ```solidity
  function commitOrder(struct AsyncOrder.OrderCommitmentRequest commitment) external returns (struct AsyncOrder.Data retOrder, uint256 fees)
  ```

<<<<<<< HEAD
  Modify the collateral delegated to the account.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `synthMarketId` (*uint128*) - Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
* `amountDelta` (*int256*) - requested change in amount of collateral delegated to the account.
=======
  Commit an async order via this function

**Parameters**
* `commitment` (*struct AsyncOrder.OrderCommitmentRequest*) - Order commitment data (see AsyncOrder.OrderCommitmentRequest struct).

**Returns**
* `retOrder` (*struct AsyncOrder.Data*) - order details (see AsyncOrder.Data struct).
* `fees` (*uint256*) - order fees (protocol + settler)
#### getOrder

  ```solidity
  function getOrder(uint128 accountId) external returns (struct AsyncOrder.Data order)
  ```

  Get async order claim details

**Parameters**
* `accountId` (*uint128*) - id of the account.

**Returns**
* `order` (*struct AsyncOrder.Data*) - async order claim details (see AsyncOrder.Data struct).
#### computeOrderFees

  ```solidity
  function computeOrderFees(uint128 marketId, int128 sizeDelta) external view returns (uint256 orderFees, uint256 fillPrice)
  ```
>>>>>>> sip-326-332-333-334

  Simulates what the order fee would be for the given market with the specified size.

  Note that this does not include the settlement reward fee, which is based on the strategy type used

**Parameters**
* `marketId` (*uint128*) - id of the market.
* `sizeDelta` (*int128*) - size of position.

**Returns**
* `orderFees` (*uint256*) - incurred fees.
* `fillPrice` (*uint256*) - price at which the order would be filled.
#### requiredMarginForOrder

  ```solidity
  function requiredMarginForOrder(uint128 marketId, uint128 accountId, int128 sizeDelta) external view returns (uint256 requiredMargin)
  ```

<<<<<<< HEAD
  Gets the account's collateral value for a specific collateral.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `synthMarketId` (*uint128*) - Id of the synth market used as collateral. Synth market id, 0 for snxUSD.

**Returns**
* `[0]` (*uint256*) - collateralValue collateral value of the account.
### totalCollateralValue

  ```solidity
  function totalCollateralValue(uint128 accountId) external view returns (uint256)
  ```

  Gets the account's total collateral value.

**Parameters**
* `accountId` (*uint128*) - Id of the account.

**Returns**
* `[0]` (*uint256*) - collateralValue total collateral value of the account. USD denominated.
### totalAccountOpenInterest

  ```solidity
  function totalAccountOpenInterest(uint128 accountId) external view returns (uint256)
  ```

  Gets the account's total open interest value.

**Parameters**
* `accountId` (*uint128*) - Id of the account.

**Returns**
* `[0]` (*uint256*) - openInterestValue total open interest value of the account.
### getOpenPosition

  ```solidity
  function getOpenPosition(uint128 accountId, uint128 marketId) external view returns (int256 pnl, int256 accruedFunding, int256 size)
  ```

  Gets the details of an open position.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `marketId` (*uint128*) - Id of the position market.

**Returns**
* `pnl` (*int256*) - pnl of the position.
* `accruedFunding` (*int256*) - accrued funding of the position.
* `size` (*int256*) - size of the position.
### getAvailableMargin

  ```solidity
  function getAvailableMargin(uint128 accountId) external view returns (int256)
  ```

  Gets the available margin of an account. It can be negative due to pnl.

**Parameters**
* `accountId` (*uint128*) - Id of the account.

**Returns**
* `[0]` (*int256*) - availableMargin available margin of the position.

### CollateralModified
=======
  For a given market, account id, and a position size, returns the required total account margin for this order to succeed
>>>>>>> sip-326-332-333-334

  Useful for integrators to determine if an order will succeed or fail

<<<<<<< HEAD
  Gets fired when an account colateral is modified.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `synthMarketId` (*uint128*) - Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
* `amountDelta` (*int256*) - requested change in amount of collateral delegated to the account.
* `sender` (*address*) - address of the sender of the size modification. Authorized by account owner.

## Async Order Module
=======
**Parameters**
* `marketId` (*uint128*) - id of the market.
* `accountId` (*uint128*) - id of the trader account.
* `sizeDelta` (*int128*) - size of position.
>>>>>>> sip-326-332-333-334

**Returns**
* `requiredMargin` (*uint256*) - margin required for the order to succeed.

<<<<<<< HEAD
  ```solidity
  function commitOrder(struct AsyncOrder.OrderCommitmentRequest commitment) external returns (struct AsyncOrder.Data retOrder, uint256 fees)
  ```

  Commit an async order via this function

**Parameters**
* `commitment` (*struct AsyncOrder.OrderCommitmentRequest*) - Order commitment data (see AsyncOrder.OrderCommitmentRequest struct).

**Returns**
* `retOrder` (*struct AsyncOrder.Data*) - order details (see AsyncOrder.Data struct).
* `fees` (*uint256*) - order fees (protocol + settler)
### cancelOrder

  ```solidity
  function cancelOrder(uint128 marketId, uint128 accountId) external
  ```

  Cancel an expired order via this function

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.

### getOrder

  ```solidity
  function getOrder(uint128 marketId, uint128 accountId) external returns (struct AsyncOrder.Data order)
  ```

  Get async order claim details

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - id of the account.

**Returns**
* `order` (*struct AsyncOrder.Data*) - async order claim details (see AsyncOrder.Data struct).

### OrderCommitted
=======
#### OrderCommitted
>>>>>>> sip-326-332-333-334

  ```solidity
  event OrderCommitted(uint128 marketId, uint128 accountId, enum SettlementStrategy.Type orderType, int128 sizeDelta, uint256 acceptablePrice, uint256 settlementTime, uint256 expirationTime, bytes32 trackingCode, address sender)
  ```

  Gets fired when a new order is committed.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.
* `orderType` (*enum SettlementStrategy.Type*) - Should send 0 (at time of writing) that correlates to the transaction type enum defined in SettlementStrategy.Type.
* `sizeDelta` (*int128*) - requested change in size of the order sent by the user.
* `acceptablePrice` (*uint256*) - maximum or minimum, depending on the sizeDelta direction, accepted price to settle the order, set by the user.
* `settlementTime` (*uint256*) - Time at which the order can be settled.
* `expirationTime` (*uint256*) - Time at which the order expired.
* `trackingCode` (*bytes32*) - Optional code for integrator tracking purposes.
* `sender` (*address*) - address of the sender of the order. Authorized to commit by account owner.

<<<<<<< HEAD
### OrderCanceled
=======
#### PreviousOrderExpired
>>>>>>> sip-326-332-333-334

  ```solidity
  event PreviousOrderExpired(uint128 marketId, uint128 accountId, int128 sizeDelta, uint256 acceptablePrice, uint256 settlementTime, bytes32 trackingCode)
  ```

<<<<<<< HEAD
  Gets fired when a new order is canceled.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.
* `settlementTime` (*uint256*) - Time at which the order can be settled.
* `acceptablePrice` (*uint256*) - maximum or minimum, depending on the sizeDelta direction, accepted price to settle the order, set by the user.

## Async Order Settlement Module
=======
  Gets fired when a new order is committed while a previous one was expired.
>>>>>>> sip-326-332-333-334

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.
* `sizeDelta` (*int128*) - requested change in size of the order sent by the user.
* `acceptablePrice` (*uint256*) - maximum or minimum, depending on the sizeDelta direction, accepted price to settle the order, set by the user.
* `settlementTime` (*uint256*) - Time at which the order can be settled.
* `trackingCode` (*bytes32*) - Optional code for integrator tracking purposes.

### Async Order Settlement Module

#### settle

  ```solidity
  function settle(uint128 accountId) external view
  ```

  Settles an offchain order. It's expected to revert with the OffchainLookup error with the data needed to perform the offchain lookup.

**Parameters**
<<<<<<< HEAD
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.

### settlePythOrder
=======
* `accountId` (*uint128*) - Id of the account used for the trade.

#### settlePythOrder
>>>>>>> sip-326-332-333-334

  ```solidity
  function settlePythOrder(bytes result, bytes extraData) external payable
  ```

  Settles an offchain order using the offchain retrieved data from pyth.
<<<<<<< HEAD

**Parameters**
* `result` (*bytes*) - the blob of data retrieved offchain.
* `extraData` (*bytes*) - Extra data from OffchainLookupData.

### OrderSettled

  ```solidity
  event OrderSettled(uint128 marketId, uint128 accountId, uint256 fillPrice, int128 sizeDelta, int128 newSize, uint256 collectedFees, uint256 settlementReward, bytes32 trackingCode, address settler)
  ```

  Gets fired when a new order is settled.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.
* `fillPrice` (*uint256*) - Price at which the order was settled.
* `sizeDelta` (*int128*) - Size delta from order.
* `newSize` (*int128*) - New size of the position after settlement.
* `collectedFees` (*uint256*) - Amount of fees collected by the protocol.
* `settlementReward` (*uint256*) - Amount of fees collected by the settler.
* `trackingCode` (*bytes32*) - Optional code for integrator tracking purposes.
* `settler` (*address*) - address of the settler of the order.

## Collateral Module
=======

**Parameters**
* `result` (*bytes*) - the blob of data retrieved offchain.
* `extraData` (*bytes*) - Extra data from OffchainLookupData.

#### OrderSettled

  ```solidity
  event OrderSettled(uint128 marketId, uint128 accountId, uint256 fillPrice, int256 pnl, int256 accruedFunding, int128 sizeDelta, int128 newSize, uint256 totalFees, uint256 referralFees, uint256 collectedFees, uint256 settlementReward, bytes32 trackingCode, address settler)
  ```
>>>>>>> sip-326-332-333-334

  Gets fired when a new order is settled.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.
* `fillPrice` (*uint256*) - Price at which the order was settled.
* `pnl` (*int256*) - Pnl of the previous closed position.
* `accruedFunding` (*int256*) - Accrued funding of the previous closed position.
* `sizeDelta` (*int128*) - Size delta from order.
* `newSize` (*int128*) - New size of the position after settlement.
* `totalFees` (*uint256*) - Amount of fees collected by the protocol.
* `referralFees` (*uint256*) - Amount of fees collected by the referrer.
* `collectedFees` (*uint256*) - Amount of fees collected by fee collector.
* `settlementReward` (*uint256*) - Amount of fees collected by the settler.
* `trackingCode` (*bytes32*) - Optional code for integrator tracking purposes.
* `settler` (*address*) - address of the settler of the order.

### Collateral Module

#### setMaxCollateralAmount

  ```solidity
  function setMaxCollateralAmount(uint128 synthMarketId, uint256 collateralAmount) external
  ```

  Set the max collateral amoutn via this function

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that for the synth

<<<<<<< HEAD
### MaxCollateralSet
=======
#### MaxCollateralSet
>>>>>>> sip-326-332-333-334

  ```solidity
  event MaxCollateralSet(uint128 synthMarketId, uint256 collateralAmount)
  ```

  Gets fired when max collateral amount for synth collateral for the system is set by owner.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that was set for the synth

<<<<<<< HEAD
## Global Perps Market Module

### setMaxCollateralAmount
=======
### Global Perps Market Module

#### setMaxCollateralAmount
>>>>>>> sip-326-332-333-334

  ```solidity
  function setMaxCollateralAmount(uint128 synthMarketId, uint256 collateralAmount) external
  ```

  Sets the max collateral amount for a specific synth market.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - Max collateral amount to set for the synth market id.

<<<<<<< HEAD
### getMaxCollateralAmount
=======
#### getMaxCollateralAmount
>>>>>>> sip-326-332-333-334

  ```solidity
  function getMaxCollateralAmount(uint128 synthMarketId) external view returns (uint256)
  ```

  Gets the max collateral amount for a specific synth market.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.

**Returns**
* `[0]` (*uint256*) - maxCollateralAmount max collateral amount of the specified synth market id
<<<<<<< HEAD
### setSynthDeductionPriority
=======
#### setSynthDeductionPriority
>>>>>>> sip-326-332-333-334

  ```solidity
  function setSynthDeductionPriority(uint128[] newSynthDeductionPriority) external
  ```

  Sets the synth deduction priority ordered list.

  The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.

**Parameters**
* `newSynthDeductionPriority` (*uint128[]*) - Ordered array of synth market ids for deduction priority.

<<<<<<< HEAD
### getSynthDeductionPriority
=======
#### getSynthDeductionPriority
>>>>>>> sip-326-332-333-334

  ```solidity
  function getSynthDeductionPriority() external view returns (uint128[])
  ```

  Gets the synth deduction priority ordered list.

  The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.

**Returns**
* `[0]` (*uint128[]*) - synthDeductionPriority Ordered array of synth market ids for deduction priority.
<<<<<<< HEAD
### setLiquidationRewardGuards
=======
#### setLiquidationRewardGuards
>>>>>>> sip-326-332-333-334

  ```solidity
  function setLiquidationRewardGuards(uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd) external
  ```

  Sets the liquidation reward guard (min and max).

**Parameters**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.

<<<<<<< HEAD
### getLiquidationRewardGuards
=======
#### getLiquidationRewardGuards
>>>>>>> sip-326-332-333-334

  ```solidity
  function getLiquidationRewardGuards() external view returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
  ```

  Gets the liquidation reward guard (min and max).

**Returns**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.
<<<<<<< HEAD

### MaxCollateralAmountSet
=======
#### totalGlobalCollateralValue

  ```solidity
  function totalGlobalCollateralValue() external view returns (uint256 totalCollateralValue)
  ```

  Gets the total collateral value of all deposited collateral from all traders.

**Returns**
* `totalCollateralValue` (*uint256*) - value of all collateral
#### setFeeCollector

  ```solidity
  function setFeeCollector(address feeCollector) external
  ```

  Sets the fee collector contract.

  must conform to the IFeeCollector interface

**Parameters**
* `feeCollector` (*address*) - address of the fee collector contract

#### getFeeCollector

  ```solidity
  function getFeeCollector() external view returns (address feeCollector)
  ```

  Gets the configured feeCollector contract

**Returns**
* `feeCollector` (*address*) - address of the fee collector contract
#### updateReferrerShare

  ```solidity
  function updateReferrerShare(address referrer, uint256 shareRatioD18) external
  ```

  Update the referral share percentage for a referrer

**Parameters**
* `referrer` (*address*) - The address of the referrer
* `shareRatioD18` (*uint256*) - The new share percentage for the referrer

#### getReferrerShare

  ```solidity
  function getReferrerShare(address referrer) external returns (uint256 shareRatioD18)
  ```

  get the referral share percentage for the specified referrer

**Parameters**
* `referrer` (*address*) - The address of the referrer

**Returns**
* `shareRatioD18` (*uint256*) - The configured share percentage for the referrer
#### getMarkets

  ```solidity
  function getMarkets() external returns (uint256[] marketIds)
  ```

  get all existing market ids

**Returns**
* `marketIds` (*uint256[]*) - an array of existing market ids

#### MaxCollateralAmountSet
>>>>>>> sip-326-332-333-334

  ```solidity
  event MaxCollateralAmountSet(uint128 synthMarketId, uint256 collateralAmount)
  ```

  Gets fired when max collateral amount for synth for all the markets is set by owner.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that was set for the synth

<<<<<<< HEAD
### SynthDeductionPrioritySet
=======
#### SynthDeductionPrioritySet
>>>>>>> sip-326-332-333-334

  ```solidity
  event SynthDeductionPrioritySet(uint128[] newSynthDeductionPriority)
  ```

  Gets fired when the synth deduction priority is updated by owner.

**Parameters**
* `newSynthDeductionPriority` (*uint128[]*) - new synth id priority order for deductions.

<<<<<<< HEAD
### LiquidationRewardGuardsSet
=======
#### LiquidationRewardGuardsSet
>>>>>>> sip-326-332-333-334

  ```solidity
  event LiquidationRewardGuardsSet(uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
  ```

  Gets fired when liquidation reward guard is set or updated.
<<<<<<< HEAD

**Parameters**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.
=======
>>>>>>> sip-326-332-333-334

**Parameters**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.

#### FeeCollectorSet

  ```solidity
  event FeeCollectorSet(address feeCollector)
  ```

  emitted when custom fee collector is set

**Parameters**
* `feeCollector` (*address*) - the address of the fee collector to set.

#### ReferrerShareUpdated

  ```solidity
  event ReferrerShareUpdated(address referrer, uint256 shareRatioD18)
  ```

  Emitted when the share percentage for a referrer address has been updated.

**Parameters**
* `referrer` (*address*) - The address of the referrer
* `shareRatioD18` (*uint256*) - The new share ratio for the referrer

### Liquidation Module

#### liquidate

  ```solidity
  function liquidate(uint128 accountId) external
  ```

  Liquidates an account.

  according to the current situation and account size it can be a partial or full liquidation.

**Parameters**
* `accountId` (*uint128*) - Id of the account to liquidate.

#### liquidateFlagged

  ```solidity
  function liquidateFlagged() external
  ```

  Liquidates all flagged accounts.

#### PositionLiquidated

  ```solidity
  event PositionLiquidated(uint128 accountId, uint128 marketId, uint256 amountLiquidated, int128 currentPositionSize)
  ```

  Gets fired when an account position is liquidated .

**Parameters**
* `accountId` (*uint128*) - Id of the account liquidated.
* `marketId` (*uint128*) - Id of the position's market.
* `amountLiquidated` (*uint256*) - amount liquidated.
* `currentPositionSize` (*int128*) - position size after liquidation.

#### AccountLiquidated

  ```solidity
  event AccountLiquidated(uint128 accountId, uint256 reward, bool fullLiquidation)
  ```

  Gets fired when an account is liquidated.

  this event is fired once per liquidation tx after the each position that can be liquidated at the time was liquidated.

**Parameters**
* `accountId` (*uint128*) - Id of the account liquidated.
* `reward` (*uint256*) - total reward sent to liquidator.
* `fullLiquidation` (*bool*) - flag indicating if it was a partial or full liquidation.

### Market Configuration Module

#### addSettlementStrategy

  ```solidity
  function addSettlementStrategy(uint128 marketId, struct SettlementStrategy.Data strategy) external returns (uint256 strategyId)
  ```

  Add a new settlement strategy with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to add the settlement strategy.
* `strategy` (*struct SettlementStrategy.Data*) - strategy details (see SettlementStrategy.Data struct).

**Returns**
* `strategyId` (*uint256*) - id of the new settlement strategy.
<<<<<<< HEAD
### setOrderFees
=======
#### setOrderFees
>>>>>>> sip-326-332-333-334

  ```solidity
  function setOrderFees(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio) external
  ```

  Set order fees for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set order fees.
* `makerFeeRatio` (*uint256*) - the maker fee ratio.
* `takerFeeRatio` (*uint256*) - the taker fee ratio.

<<<<<<< HEAD
### setFundingParameters
=======
#### updatePriceData

  ```solidity
  function updatePriceData(uint128 perpsMarketId, bytes32 feedId) external
  ```

  Set node id for perps market

**Parameters**
* `perpsMarketId` (*uint128*) - id of the market to set price feed.
* `feedId` (*bytes32*) - the node feed id

#### setFundingParameters
>>>>>>> sip-326-332-333-334

  ```solidity
  function setFundingParameters(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity) external
  ```

  Set funding parameters for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set funding parameters.
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.

<<<<<<< HEAD
### setLiquidationParameters
=======
#### setLiquidationParameters
>>>>>>> sip-326-332-333-334

  ```solidity
  function setLiquidationParameters(uint128 marketId, uint256 initialMarginRatioD18, uint256 minimumInitialMarginRatioD18, uint256 maintenanceMarginScalarD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow, uint256 minimumPositionMargin) external
  ```

  Set liquidation parameters for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set liquidation parameters.
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
<<<<<<< HEAD
* `maintenanceMarginRatioD18` (*uint256*) - the maintenance margin ratio (as decimal with 18 digits precision).
=======
* `minimumInitialMarginRatioD18` (*uint256*) - the minimum initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginScalarD18` (*uint256*) - the maintenance margin scalar relative to the initial margin ratio (as decimal with 18 digits precision).
>>>>>>> sip-326-332-333-334
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
* `minimumPositionMargin` (*uint256*) - the minimum position margin.

<<<<<<< HEAD
### setMaxMarketSize
=======
#### setMaxMarketSize
>>>>>>> sip-326-332-333-334

  ```solidity
  function setMaxMarketSize(uint128 marketId, uint256 maxMarketSize) external
  ```

  Set the max size of an specific market with this function.

  This controls the maximum open interest a market can have on either side (Long | Short). So the total Open Interest (with zero skew) for a market can be up to max market size * 2.

**Parameters**
* `marketId` (*uint128*) - id of the market to set the max market value.
* `maxMarketSize` (*uint256*) - the max market size in market asset units.

<<<<<<< HEAD
### setLockedOiRatio
=======
#### setLockedOiRatio
>>>>>>> sip-326-332-333-334

  ```solidity
  function setLockedOiRatio(uint128 marketId, uint256 lockedOiRatioD18) external
  ```

  Set the locked OI Ratio for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set locked OI ratio.
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

<<<<<<< HEAD
### setSettlementStrategyEnabled
=======
#### setSettlementStrategyEnabled
>>>>>>> sip-326-332-333-334

  ```solidity
  function setSettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled) external
  ```

  Enable or disable a settlement strategy for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market.
* `strategyId` (*uint256*) - the specific strategy.
* `enabled` (*bool*) - whether the strategy is enabled or disabled.

<<<<<<< HEAD
### getSettlementStrategy
=======
#### getSettlementStrategy
>>>>>>> sip-326-332-333-334

  ```solidity
  function getSettlementStrategy(uint128 marketId, uint256 strategyId) external view returns (struct SettlementStrategy.Data settlementStrategy)
  ```

  Gets the settlement strategy details.

**Parameters**
* `marketId` (*uint128*) - id of the market.
* `strategyId` (*uint256*) - id of the settlement strategy.

**Returns**
* `settlementStrategy` (*struct SettlementStrategy.Data*) - strategy details (see SettlementStrategy.Data struct).
<<<<<<< HEAD
### getLiquidationParameters
=======
#### getLiquidationParameters
>>>>>>> sip-326-332-333-334

  ```solidity
  function getLiquidationParameters(uint128 marketId) external view returns (uint256 initialMarginRatioD18, uint256 minimumInitialMarginRatioD18, uint256 maintenanceMarginScalarD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow, uint256 minimumPositionMargin)
  ```

  Gets liquidation parameters details of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
<<<<<<< HEAD
* `maintenanceMarginRatioD18` (*uint256*) - the maintenance margin ratio (as decimal with 18 digits precision).
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
### getFundingParameters
=======
* `minimumInitialMarginRatioD18` (*uint256*) - the minimum initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginScalarD18` (*uint256*) - the maintenance margin scalar relative to the initial margin ratio (as decimal with 18 digits precision).
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
* `minimumPositionMargin` (*uint256*) - the minimum position margin.
#### getFundingParameters
>>>>>>> sip-326-332-333-334

  ```solidity
  function getFundingParameters(uint128 marketId) external view returns (uint256 skewScale, uint256 maxFundingVelocity)
  ```

  Gets funding parameters of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.
<<<<<<< HEAD
### getMaxMarketSize
=======
#### getMaxMarketSize
>>>>>>> sip-326-332-333-334

  ```solidity
  function getMaxMarketSize(uint128 marketId) external view returns (uint256 maxMarketSize)
  ```

  Gets the max size of an specific market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `maxMarketSize` (*uint256*) - the max market size in market asset units.
<<<<<<< HEAD
### getOrderFees
=======
#### getOrderFees
>>>>>>> sip-326-332-333-334

  ```solidity
  function getOrderFees(uint128 marketId) external view returns (uint256 makerFeeRatio, uint256 takerFeeRatio)
  ```

  Gets the order fees of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `makerFeeRatio` (*uint256*) - the maker fee ratio.
* `takerFeeRatio` (*uint256*) - the taker fee ratio.
<<<<<<< HEAD
### getLockedOiRatioD18
=======
#### getLockedOiRatio
>>>>>>> sip-326-332-333-334

  ```solidity
  function getLockedOiRatio(uint128 marketId) external view returns (uint256 lockedOiRatioD18)
  ```

  Gets the locked OI ratio of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

<<<<<<< HEAD
### SettlementStrategyAdded
=======
#### SettlementStrategyAdded
>>>>>>> sip-326-332-333-334

  ```solidity
  event SettlementStrategyAdded(uint128 marketId, struct SettlementStrategy.Data strategy, uint256 strategyId)
  ```

  Gets fired when new settlement strategy is added.

**Parameters**
* `marketId` (*uint128*) - adds settlement strategy to this specific market.
* `strategy` (*struct SettlementStrategy.Data*) - the strategy configuration.
* `strategyId` (*uint256*) - the newly created settlement strategy id.

#### MarketPriceDataUpdated

  ```solidity
  event MarketPriceDataUpdated(uint128 marketId, bytes32 feedId)
  ```

  Gets fired when feed id for perps market is updated.

**Parameters**
* `marketId` (*uint128*) - id of perps market
* `feedId` (*bytes32*) - oracle node id

#### OrderFeesSet

  ```solidity
  event OrderFeesSet(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio)
  ```

  Gets fired when order fees are updated.

**Parameters**
* `marketId` (*uint128*) - udpates fees to this specific market.
* `makerFeeRatio` (*uint256*) - the maker fee ratio.
* `takerFeeRatio` (*uint256*) - the taker fee ratio.

<<<<<<< HEAD
### FundingParametersSet
=======
#### FundingParametersSet
>>>>>>> sip-326-332-333-334

  ```solidity
  event FundingParametersSet(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity)
  ```

  Gets fired when funding parameters are updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.

<<<<<<< HEAD
### LiquidationParametersSet
=======
#### LiquidationParametersSet
>>>>>>> sip-326-332-333-334

  ```solidity
  event LiquidationParametersSet(uint128 marketId, uint256 initialMarginRatioD18, uint256 maintenanceMarginRatioD18, uint256 minimumInitialMarginRatioD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow, uint256 minimumPositionMargin)
  ```

  Gets fired when liquidation parameters are updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginRatioD18` (*uint256*) - the maintenance margin ratio (as decimal with 18 digits precision).
<<<<<<< HEAD
=======
* `minimumInitialMarginRatioD18` (*uint256*) - 
>>>>>>> sip-326-332-333-334
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
* `minimumPositionMargin` (*uint256*) - the minimum position margin.

<<<<<<< HEAD
### MaxMarketSizeSet
=======
#### MaxMarketSizeSet
>>>>>>> sip-326-332-333-334

  ```solidity
  event MaxMarketSizeSet(uint128 marketId, uint256 maxMarketSize)
  ```

  Gets fired when max market value is updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `maxMarketSize` (*uint256*) - the max market value.

<<<<<<< HEAD
### LockedOiRatioD18Set
=======
#### LockedOiRatioSet
>>>>>>> sip-326-332-333-334

  ```solidity
  event LockedOiRatioSet(uint128 marketId, uint256 lockedOiRatioD18)
  ```

  Gets fired when locked oi ratio is updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

<<<<<<< HEAD
### SettlementStrategyEnabled
=======
#### SettlementStrategyEnabled
>>>>>>> sip-326-332-333-334

  ```solidity
  event SettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled)
  ```

  Gets fired when a settlement strategy is enabled or disabled.
<<<<<<< HEAD

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `strategyId` (*uint256*) - the specific strategy.
* `enabled` (*bool*) - whether the strategy is enabled or disabled.

## IMarketEvents
=======
>>>>>>> sip-326-332-333-334

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `strategyId` (*uint256*) - the specific strategy.
* `enabled` (*bool*) - whether the strategy is enabled or disabled.

### IMarketEvents

#### MarketUpdated

  ```solidity
  event MarketUpdated(uint128 marketId, uint256 price, int256 skew, uint256 size, int256 sizeDelta, int256 currentFundingRate, int256 currentFundingVelocity)
  ```

  Gets fired when the size of a market is updated by new orders or liquidations.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `price` (*uint256*) - Price at the time of this event.
* `skew` (*int256*) - Market skew at the time of the trade. Positive values mean more longs.
* `size` (*uint256*) - Size of the entire market after settlement.
* `sizeDelta` (*int256*) - Change in market size during this update.
* `currentFundingRate` (*int256*) - The current funding rate of this market (0.001 = 0.1% per day)
* `currentFundingVelocity` (*int256*) - The current rate of change of the funding rate (0.001 = +0.1% per day)

### Perps Account Module

#### modifyCollateral

  ```solidity
  function modifyCollateral(uint128 accountId, uint128 synthMarketId, int256 amountDelta) external
  ```

  Modify the collateral delegated to the account.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `synthMarketId` (*uint128*) - Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
* `amountDelta` (*int256*) - requested change in amount of collateral delegated to the account.

#### getCollateralAmount

  ```solidity
  function getCollateralAmount(uint128 accountId, uint128 synthMarketId) external view returns (uint256)
  ```

  Gets the account's collateral value for a specific collateral.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `synthMarketId` (*uint128*) - Id of the synth market used as collateral. Synth market id, 0 for snxUSD.

**Returns**
* `[0]` (*uint256*) - collateralValue collateral value of the account.
#### totalCollateralValue

  ```solidity
  function totalCollateralValue(uint128 accountId) external view returns (uint256)
  ```

  Gets the account's total collateral value.

**Parameters**
* `accountId` (*uint128*) - Id of the account.

**Returns**
* `[0]` (*uint256*) - collateralValue total collateral value of the account. USD denominated.
#### totalAccountOpenInterest

  ```solidity
  function totalAccountOpenInterest(uint128 accountId) external view returns (uint256)
  ```

  Gets the account's total open interest value.

**Parameters**
* `accountId` (*uint128*) - Id of the account.

**Returns**
* `[0]` (*uint256*) - openInterestValue total open interest value of the account.
#### getOpenPosition

  ```solidity
  function getOpenPosition(uint128 accountId, uint128 marketId) external view returns (int256 totalPnl, int256 accruedFunding, int128 positionSize)
  ```

  Gets the details of an open position.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `marketId` (*uint128*) - Id of the position market.

**Returns**
* `totalPnl` (*int256*) - pnl of the entire position including funding.
* `accruedFunding` (*int256*) - accrued funding of the position.
* `positionSize` (*int128*) - size of the position.
#### getAvailableMargin

  ```solidity
  function getAvailableMargin(uint128 accountId) external view returns (int256 availableMargin)
  ```

  Gets the available margin of an account. It can be negative due to pnl.

**Parameters**
* `accountId` (*uint128*) - Id of the account.

**Returns**
* `availableMargin` (*int256*) - available margin of the position.
#### getWithdrawableMargin

  ```solidity
  function getWithdrawableMargin(uint128 accountId) external view returns (int256 withdrawableMargin)
  ```

  Gets the exact withdrawable amount a trader has available from this account while holding the account's current positions.

**Parameters**
* `accountId` (*uint128*) - Id of the account.

**Returns**
* `withdrawableMargin` (*int256*) - available margin to withdraw.
#### getRequiredMargins

  ```solidity
  function getRequiredMargins(uint128 accountId) external view returns (uint256 requiredInitialMargin, uint256 requiredMaintenanceMargin, uint256 totalAccumulatedLiquidationRewards, uint256 maxLiquidationReward)
  ```

  Gets the initial/maintenance margins across all positions that an account has open.

**Parameters**
* `accountId` (*uint128*) - Id of the account.

**Returns**
* `requiredInitialMargin` (*uint256*) - initial margin req (used when withdrawing collateral).
* `requiredMaintenanceMargin` (*uint256*) - maintenance margin req (used to determine liquidation threshold).
* `totalAccumulatedLiquidationRewards` (*uint256*) - sum of all liquidation rewards of if all account open positions were to be liquidated fully.
* `maxLiquidationReward` (*uint256*) - max liquidation reward the keeper would receive if account was fully liquidated. Note here that the accumulated rewards are checked against the global max/min configured liquidation rewards.

#### CollateralModified

  ```solidity
  event CollateralModified(uint128 accountId, uint128 synthMarketId, int256 amountDelta, address sender)
  ```

  Gets fired when an account colateral is modified.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `synthMarketId` (*uint128*) - Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
* `amountDelta` (*int256*) - requested change in amount of collateral delegated to the account.
* `sender` (*address*) - address of the sender of the size modification. Authorized by account owner.

### Perps Market Factory Module

#### initializeFactory

  ```solidity
  function initializeFactory() external returns (uint128)
  ```

  Initializes the factory.

  this function should be called only once.

**Returns**
* `[0]` (*uint128*) - globalPerpsMarketId Id of the global perps market id.
#### setSynthetix

  ```solidity
  function setSynthetix(contract ISynthetixSystem synthetix) external
  ```

  Sets the synthetix system.

**Parameters**
* `synthetix` (*contract ISynthetixSystem*) - address of the main synthetix proxy.

#### setSpotMarket

  ```solidity
  function setSpotMarket(contract ISpotMarketSystem spotMarket) external
  ```

  Sets the spot market system.

**Parameters**
* `spotMarket` (*contract ISpotMarketSystem*) - address of the spot market proxy.

#### createMarket

  ```solidity
  function createMarket(uint128 requestedMarketId, string marketName, string marketSymbol) external returns (uint128)
  ```

  Creates a new market.

**Parameters**
* `requestedMarketId` (*uint128*) - id of the market to create.
* `marketName` (*string*) - name of the market to create.
* `marketSymbol` (*string*) - symbol of the market to create.

**Returns**
* `[0]` (*uint128*) - perpsMarketId Id of the created perps market.
#### name

  ```solidity
  function name(uint128 marketId) external view returns (string)
  ```

  returns a human-readable name for a given market

#### reportedDebt

  ```solidity
  function reportedDebt(uint128 marketId) external view returns (uint256)
  ```

  returns amount of USD that the market would try to mint if everything was withdrawn

#### minimumCredit

  ```solidity
  function minimumCredit(uint128 marketId) external view returns (uint256)
  ```

  prevents reduction of available credit capacity by specifying this amount, for which withdrawals will be disallowed

#### supportsInterface

  ```solidity
  function supportsInterface(bytes4 interfaceID) external view returns (bool)
  ```

  Determines if the contract in question supports the specified interface.

**Parameters**
* `interfaceID` (*bytes4*) - XOR of all selectors in the contract.

**Returns**
* `[0]` (*bool*) - True if the contract supports the specified interface.

#### FactoryInitialized

  ```solidity
  event FactoryInitialized(uint128 globalPerpsMarketId)
  ```

  Gets fired when the factory is initialized.

**Parameters**
* `globalPerpsMarketId` (*uint128*) - the new global perps market id.

#### MarketCreated

  ```solidity
  event MarketCreated(uint128 perpsMarketId, string marketName, string marketSymbol)
  ```

  Gets fired when a market is created.

**Parameters**
* `perpsMarketId` (*uint128*) - the newly created perps market id.
* `marketName` (*string*) - the newly created perps market name.
* `marketSymbol` (*string*) - the newly created perps market symbol.

### Perps Market Module

#### metadata

  ```solidity
  function metadata(uint128 marketId) external view returns (string name, string symbol)
  ```

  Gets a market metadata.

**Parameters**
* `marketId` (*uint128*) - Id of the market.

**Returns**
* `name` (*string*) - Name of the market.
* `symbol` (*string*) - Symbol of the market.
#### skew

  ```solidity
  function skew(uint128 marketId) external view returns (int256)
  ```

  Gets a market's skew.

**Parameters**
* `marketId` (*uint128*) - Id of the market.

**Returns**
* `[0]` (*int256*) - skew Skew of the market.
#### size

  ```solidity
  function size(uint128 marketId) external view returns (uint256)
  ```

  Gets a market's size.

**Parameters**
* `marketId` (*uint128*) - Id of the market.

**Returns**
* `[0]` (*uint256*) - size Size of the market.
#### maxOpenInterest

  ```solidity
  function maxOpenInterest(uint128 marketId) external view returns (uint256)
  ```

  Gets a market's max open interest.

**Parameters**
* `marketId` (*uint128*) - Id of the market.

**Returns**
* `[0]` (*uint256*) - maxOpenInterest Max open interest of the market.
#### currentFundingRate

  ```solidity
  function currentFundingRate(uint128 marketId) external view returns (int256)
  ```

  Gets a market's current funding rate.

**Parameters**
* `marketId` (*uint128*) - Id of the market.

**Returns**
* `[0]` (*int256*) - currentFundingRate Current funding rate of the market.
#### currentFundingVelocity

  ```solidity
  function currentFundingVelocity(uint128 marketId) external view returns (int256)
  ```

  Gets a market's current funding velocity.

**Parameters**
* `marketId` (*uint128*) - Id of the market.

**Returns**
* `[0]` (*int256*) - currentFundingVelocity Current funding velocity of the market.
#### indexPrice

  ```solidity
  function indexPrice(uint128 marketId) external view returns (uint256)
  ```

  Gets a market's index price.

**Parameters**
* `marketId` (*uint128*) - Id of the market.

**Returns**
* `[0]` (*uint256*) - indexPrice Index price of the market.
#### fillPrice

  ```solidity
  function fillPrice(uint128 marketId, int128 orderSize, uint256 price) external returns (uint256)
  ```

  Gets a market's fill price for a specific order size and index price.

**Parameters**
* `marketId` (*uint128*) - Id of the market.
* `orderSize` (*int128*) - Order size.
* `price` (*uint256*) - Index price.

**Returns**
* `[0]` (*uint256*) - price Fill price.
#### getMarketSummary

  ```solidity
  function getMarketSummary(uint128 marketId) external view returns (struct IPerpsMarketModule.MarketSummary summary)
  ```

  Given a marketId return a market's summary details in one call.

**Parameters**
* `marketId` (*uint128*) - Id of the market.

**Returns**
* `summary` (*struct IPerpsMarketModule.MarketSummary*) - Market summary (see MarketSummary).

## Governance

- [Back to TOC](#smart-contracts)

### Council Token Module

#### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns whether the token has been initialized.

**Returns**
* `[0]` (*bool*) - A boolean with the result of the query.
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

**Parameters**
* `to` (*address*) - The address to receive the newly minted tokens.
* `tokenId` (*uint256*) - The ID of the newly minted token

#### safeMint

  ```solidity
  function safeMint(address to, uint256 tokenId, bytes data) external
  ```

  Allows the owner to mint tokens. Verifies that the receiver can receive the token

**Parameters**
* `to` (*address*) - The address to receive the newly minted token.
* `tokenId` (*uint256*) - The ID of the newly minted token
* `data` (*bytes*) - any data which should be sent to the receiver

#### burn

  ```solidity
  function burn(uint256 tokenId) external
  ```

  Allows the owner to burn tokens.

**Parameters**
* `tokenId` (*uint256*) - The token to burn

#### setAllowance

  ```solidity
  function setAllowance(uint256 tokenId, address spender) external
  ```

  Allows an address that holds tokens to provide allowance to another.

**Parameters**
* `tokenId` (*uint256*) - The token which should be allowed to spender
* `spender` (*address*) - The address that is given allowance.

#### setBaseTokenURI

  ```solidity
  function setBaseTokenURI(string uri) external
  ```

  Allows the owner to update the base token URI.

**Parameters**
* `uri` (*string*) - The new base token uri

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

### IDebtShare

#### balanceOfOnPeriod

  ```solidity
  function balanceOfOnPeriod(address account, uint256 periodId) external view returns (uint256)
  ```

### Election Inspector Module

#### getEpochStartDateForIndex

  ```solidity
  function getEpochStartDateForIndex(uint256 epochIndex) external view returns (uint64)
  ```

  Returns the date in which the given epoch started

#### getEpochEndDateForIndex

  ```solidity
  function getEpochEndDateForIndex(uint256 epochIndex) external view returns (uint64)
  ```

  Returns the date in which the given epoch ended

#### getNominationPeriodStartDateForIndex

  ```solidity
  function getNominationPeriodStartDateForIndex(uint256 epochIndex) external view returns (uint64)
  ```

  Returns the date in which the Nomination period in the given epoch started

#### getVotingPeriodStartDateForIndex

  ```solidity
  function getVotingPeriodStartDateForIndex(uint256 epochIndex) external view returns (uint64)
  ```

  Returns the date in which the Voting period in the given epoch started

#### wasNominated

  ```solidity
  function wasNominated(address candidate, uint256 epochIndex) external view returns (bool)
  ```

  Shows if a candidate was nominated in the given epoch

#### getNomineesAtEpoch

  ```solidity
  function getNomineesAtEpoch(uint256 epochIndex) external view returns (address[])
  ```

  Returns a list of all nominated candidates in the given epoch

#### getBallotVotedAtEpoch

  ```solidity
  function getBallotVotedAtEpoch(address user, uint256 epochIndex) external view returns (bytes32)
  ```

  Returns the ballot id that user voted on in the given election

#### hasVotedInEpoch

  ```solidity
  function hasVotedInEpoch(address user, uint256 epochIndex) external view returns (bool)
  ```

  Returns if user has voted in the given election

#### getBallotVotesInEpoch

  ```solidity
  function getBallotVotesInEpoch(bytes32 ballotId, uint256 epochIndex) external view returns (uint256)
  ```

  Returns the number of votes given to a particular ballot in a given epoch

#### getBallotCandidatesInEpoch

  ```solidity
  function getBallotCandidatesInEpoch(bytes32 ballotId, uint256 epochIndex) external view returns (address[])
  ```

  Returns the list of candidates that a particular ballot has in a given epoch

#### getCandidateVotesInEpoch

  ```solidity
  function getCandidateVotesInEpoch(address candidate, uint256 epochIndex) external view returns (uint256)
  ```

  Returns the number of votes a candidate received in a given epoch

#### getElectionWinnersInEpoch

  ```solidity
  function getElectionWinnersInEpoch(uint256 epochIndex) external view returns (address[])
  ```

  Returns the winners of the given election

### Election Module

#### initOrUpgradeElectionModule

  ```solidity
  function initOrUpgradeElectionModule(address[] firstCouncil, uint8 minimumActiveMembers, uint64 nominationPeriodStartDate, uint64 votingPeriodStartDate, uint64 epochEndDate) external
  ```

  Initializes the module and immediately starts the first epoch

#### isElectionModuleInitialized

  ```solidity
  function isElectionModuleInitialized() external view returns (bool)
  ```

  Shows whether the module has been initialized

#### tweakEpochSchedule

  ```solidity
  function tweakEpochSchedule(uint64 newNominationPeriodStartDate, uint64 newVotingPeriodStartDate, uint64 newEpochEndDate) external
  ```

  Adjusts the current epoch schedule requiring that the current period remains Administration, and that changes are small (see setMaxDateAdjustmentTolerance)

#### modifyEpochSchedule

  ```solidity
  function modifyEpochSchedule(uint64 newNominationPeriodStartDate, uint64 newVotingPeriodStartDate, uint64 newEpochEndDate) external
  ```

  Adjusts the current epoch schedule requiring that the current period remains Administration

#### setMinEpochDurations

  ```solidity
  function setMinEpochDurations(uint64 newMinNominationPeriodDuration, uint64 newMinVotingPeriodDuration, uint64 newMinEpochDuration) external
  ```

  Determines minimum values for epoch schedule adjustments

#### setMaxDateAdjustmentTolerance

  ```solidity
  function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external
  ```

  Determines adjustment size for tweakEpochSchedule

#### setDefaultBallotEvaluationBatchSize

  ```solidity
  function setDefaultBallotEvaluationBatchSize(uint256 newDefaultBallotEvaluationBatchSize) external
  ```

  Determines batch size when evaluate() is called with numBallots = 0

#### setNextEpochSeatCount

  ```solidity
  function setNextEpochSeatCount(uint8 newSeatCount) external
  ```

  Determines the number of council members in the next epoch

#### setMinimumActiveMembers

  ```solidity
  function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external
  ```

  Determines the minimum number of council members before triggering an emergency election

#### dismissMembers

  ```solidity
  function dismissMembers(address[] members) external
  ```

  Allows the owner to remove one or more council members, triggering an election if a threshold is met

#### nominate

  ```solidity
  function nominate() external
  ```

  Allows anyone to self-nominate during the Nomination period

#### withdrawNomination

  ```solidity
  function withdrawNomination() external
  ```

  Self-withdrawal of nominations during the Nomination period

#### cast

  ```solidity
  function cast(address[] candidates) external
  ```

  Allows anyone with vote power to vote on nominated candidates during the Voting period

#### withdrawVote

  ```solidity
  function withdrawVote() external
  ```

  Allows votes to be withdraw

#### evaluate

  ```solidity
  function evaluate(uint256 numBallots) external
  ```

  Processes ballots in batches during the Evaluation period (after epochEndDate)

#### resolve

  ```solidity
  function resolve() external
  ```

  Shuffles NFTs and resolves an election after it has been evaluated

#### getMinEpochDurations

  ```solidity
  function getMinEpochDurations() external view returns (uint64 minNominationPeriodDuration, uint64 minVotingPeriodDuration, uint64 minEpochDuration)
  ```

  Exposes minimum durations required when adjusting epoch schedules

#### getMaxDateAdjustmenTolerance

  ```solidity
  function getMaxDateAdjustmenTolerance() external view returns (uint64)
  ```

  Exposes maximum size of adjustments when calling tweakEpochSchedule

#### getDefaultBallotEvaluationBatchSize

  ```solidity
  function getDefaultBallotEvaluationBatchSize() external view returns (uint256)
  ```

  Shows the default batch size when calling evaluate() with numBallots = 0

#### getNextEpochSeatCount

  ```solidity
  function getNextEpochSeatCount() external view returns (uint8)
  ```

  Shows the number of council members that the next epoch will have

#### getMinimumActiveMembers

  ```solidity
  function getMinimumActiveMembers() external view returns (uint8)
  ```

  Returns the minimum active members that the council needs to avoid an emergency election

#### getEpochIndex

  ```solidity
  function getEpochIndex() external view returns (uint256)
  ```

  Returns the index of the current epoch. The first epoch's index is 1

#### getEpochStartDate

  ```solidity
  function getEpochStartDate() external view returns (uint64)
  ```

  Returns the date in which the current epoch started

#### getEpochEndDate

  ```solidity
  function getEpochEndDate() external view returns (uint64)
  ```

  Returns the date in which the current epoch will end

#### getNominationPeriodStartDate

  ```solidity
  function getNominationPeriodStartDate() external view returns (uint64)
  ```

  Returns the date in which the Nomination period in the current epoch will start

#### getVotingPeriodStartDate

  ```solidity
  function getVotingPeriodStartDate() external view returns (uint64)
  ```

  Returns the date in which the Voting period in the current epoch will start

#### getCurrentPeriod

  ```solidity
  function getCurrentPeriod() external view returns (uint256)
  ```

  Returns the current period type: Administration, Nomination, Voting, Evaluation

#### isNominated

  ```solidity
  function isNominated(address candidate) external view returns (bool)
  ```

  Shows if a candidate has been nominated in the current epoch

#### getNominees

  ```solidity
  function getNominees() external view returns (address[])
  ```

  Returns a list of all nominated candidates in the current epoch

#### calculateBallotId

  ```solidity
  function calculateBallotId(address[] candidates) external pure returns (bytes32)
  ```

  Hashes a list of candidates (used for identifying and storing ballots)

#### getBallotVoted

  ```solidity
  function getBallotVoted(address user) external view returns (bytes32)
  ```

  Returns the ballot id that user voted on in the current election

#### hasVoted

  ```solidity
  function hasVoted(address user) external view returns (bool)
  ```

  Returns if user has voted in the current election

#### getVotePower

  ```solidity
  function getVotePower(address user) external view returns (uint256)
  ```

  Returns the vote power of user in the current election

#### getBallotVotes

  ```solidity
  function getBallotVotes(bytes32 ballotId) external view returns (uint256)
  ```

  Returns the number of votes given to a particular ballot

#### getBallotCandidates

  ```solidity
  function getBallotCandidates(bytes32 ballotId) external view returns (address[])
  ```

  Returns the list of candidates that a particular ballot has

#### isElectionEvaluated

  ```solidity
  function isElectionEvaluated() external view returns (bool)
  ```

  Returns whether all ballots in the current election have been counted

#### getCandidateVotes

  ```solidity
  function getCandidateVotes(address candidate) external view returns (uint256)
  ```

  Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated

#### getElectionWinners

  ```solidity
  function getElectionWinners() external view returns (address[])
  ```

  Returns the winners of the current election. Requires the election to be partially or totally evaluated

#### getCouncilToken

  ```solidity
  function getCouncilToken() external view returns (address)
  ```

  Returns the address of the council NFT token

#### getCouncilMembers

  ```solidity
  function getCouncilMembers() external view returns (address[])
  ```

  Returns the current NFT token holders

### Synthetix Election Module

#### initOrUpgradeElectionModule

  ```solidity
  function initOrUpgradeElectionModule(address[] firstCouncil, uint8 minimumActiveMembers, uint64 nominationPeriodStartDate, uint64 votingPeriodStartDate, uint64 epochEndDate, address debtShareContract) external
  ```

  Initializes the module and immediately starts the first epoch

#### setDebtShareContract

  ```solidity
  function setDebtShareContract(address newDebtShareContractAddress) external
  ```

  Sets the Synthetix v2 DebtShare contract that determines vote power

#### getDebtShareContract

  ```solidity
  function getDebtShareContract() external view returns (address)
  ```

  Returns the Synthetix v2 DebtShare contract that determines vote power

#### setDebtShareSnapshotId

  ```solidity
  function setDebtShareSnapshotId(uint256 snapshotId) external
  ```

  Sets the Synthetix v2 DebtShare snapshot that determines vote power for this epoch

#### getDebtShareSnapshotId

  ```solidity
  function getDebtShareSnapshotId() external view returns (uint256)
  ```

  Returns the Synthetix v2 DebtShare snapshot id set for this epoch

#### getDebtShare

  ```solidity
  function getDebtShare(address user) external view returns (uint256)
  ```

  Returns the Synthetix v2 debt share for the provided address, at this epoch's snapshot

#### setCrossChainDebtShareMerkleRoot

  ```solidity
  function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint256 blocknumber) external
  ```

  Allows the system owner to declare a merkle root for user debt shares on other chains for this epoch

#### getCrossChainDebtShareMerkleRoot

  ```solidity
  function getCrossChainDebtShareMerkleRoot() external view returns (bytes32)
  ```

  Returns the current epoch's merkle root for user debt shares on other chains

#### getCrossChainDebtShareMerkleRootBlockNumber

  ```solidity
  function getCrossChainDebtShareMerkleRootBlockNumber() external view returns (uint256)
  ```

  Returns the current epoch's merkle root block number

#### declareCrossChainDebtShare

  ```solidity
  function declareCrossChainDebtShare(address account, uint256 debtShare, bytes32[] merkleProof) external
  ```

  Allows users to declare their Synthetix v2 debt shares on other chains

#### getDeclaredCrossChainDebtShare

  ```solidity
  function getDeclaredCrossChainDebtShare(address account) external view returns (uint256)
  ```

  Returns the Synthetix v2 debt shares for the provided address, at this epoch's snapshot, in other chains

#### declareAndCast

  ```solidity
  function declareAndCast(uint256 debtShare, bytes32[] merkleProof, address[] candidates) external
  ```

  Declares cross chain debt shares and casts a vote

#### initOrUpgradeElectionModule

  ```solidity
  function initOrUpgradeElectionModule(address[] firstCouncil, uint8 minimumActiveMembers, uint64 nominationPeriodStartDate, uint64 votingPeriodStartDate, uint64 epochEndDate) external
  ```

  Initializes the module and immediately starts the first epoch

#### isElectionModuleInitialized

  ```solidity
  function isElectionModuleInitialized() external view returns (bool)
  ```

  Shows whether the module has been initialized

#### tweakEpochSchedule

  ```solidity
  function tweakEpochSchedule(uint64 newNominationPeriodStartDate, uint64 newVotingPeriodStartDate, uint64 newEpochEndDate) external
  ```

  Adjusts the current epoch schedule requiring that the current period remains Administration, and that changes are small (see setMaxDateAdjustmentTolerance)

#### modifyEpochSchedule

  ```solidity
  function modifyEpochSchedule(uint64 newNominationPeriodStartDate, uint64 newVotingPeriodStartDate, uint64 newEpochEndDate) external
  ```

  Adjusts the current epoch schedule requiring that the current period remains Administration

#### setMinEpochDurations

  ```solidity
  function setMinEpochDurations(uint64 newMinNominationPeriodDuration, uint64 newMinVotingPeriodDuration, uint64 newMinEpochDuration) external
  ```

  Determines minimum values for epoch schedule adjustments

#### setMaxDateAdjustmentTolerance

  ```solidity
  function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external
  ```

  Determines adjustment size for tweakEpochSchedule

#### setDefaultBallotEvaluationBatchSize

  ```solidity
  function setDefaultBallotEvaluationBatchSize(uint256 newDefaultBallotEvaluationBatchSize) external
  ```

  Determines batch size when evaluate() is called with numBallots = 0

#### setNextEpochSeatCount

  ```solidity
  function setNextEpochSeatCount(uint8 newSeatCount) external
  ```

  Determines the number of council members in the next epoch

#### setMinimumActiveMembers

  ```solidity
  function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external
  ```

  Determines the minimum number of council members before triggering an emergency election

#### dismissMembers

  ```solidity
  function dismissMembers(address[] members) external
  ```

  Allows the owner to remove one or more council members, triggering an election if a threshold is met

#### nominate

  ```solidity
  function nominate() external
  ```

  Allows anyone to self-nominate during the Nomination period

#### withdrawNomination

  ```solidity
  function withdrawNomination() external
  ```

  Self-withdrawal of nominations during the Nomination period

#### cast

  ```solidity
  function cast(address[] candidates) external
  ```

  Allows anyone with vote power to vote on nominated candidates during the Voting period

#### withdrawVote

  ```solidity
  function withdrawVote() external
  ```

  Allows votes to be withdraw

#### evaluate

  ```solidity
  function evaluate(uint256 numBallots) external
  ```

  Processes ballots in batches during the Evaluation period (after epochEndDate)

#### resolve

  ```solidity
  function resolve() external
  ```

  Shuffles NFTs and resolves an election after it has been evaluated

#### getMinEpochDurations

  ```solidity
  function getMinEpochDurations() external view returns (uint64 minNominationPeriodDuration, uint64 minVotingPeriodDuration, uint64 minEpochDuration)
  ```

  Exposes minimum durations required when adjusting epoch schedules

#### getMaxDateAdjustmenTolerance

  ```solidity
  function getMaxDateAdjustmenTolerance() external view returns (uint64)
  ```

  Exposes maximum size of adjustments when calling tweakEpochSchedule

#### getDefaultBallotEvaluationBatchSize

  ```solidity
  function getDefaultBallotEvaluationBatchSize() external view returns (uint256)
  ```

  Shows the default batch size when calling evaluate() with numBallots = 0

#### getNextEpochSeatCount

  ```solidity
  function getNextEpochSeatCount() external view returns (uint8)
  ```

  Shows the number of council members that the next epoch will have

#### getMinimumActiveMembers

  ```solidity
  function getMinimumActiveMembers() external view returns (uint8)
  ```

  Returns the minimum active members that the council needs to avoid an emergency election

#### getEpochIndex

  ```solidity
  function getEpochIndex() external view returns (uint256)
  ```

  Returns the index of the current epoch. The first epoch's index is 1

#### getEpochStartDate

  ```solidity
  function getEpochStartDate() external view returns (uint64)
  ```

  Returns the date in which the current epoch started

#### getEpochEndDate

  ```solidity
  function getEpochEndDate() external view returns (uint64)
  ```

  Returns the date in which the current epoch will end

#### getNominationPeriodStartDate

  ```solidity
  function getNominationPeriodStartDate() external view returns (uint64)
  ```

  Returns the date in which the Nomination period in the current epoch will start

#### getVotingPeriodStartDate

  ```solidity
  function getVotingPeriodStartDate() external view returns (uint64)
  ```

  Returns the date in which the Voting period in the current epoch will start

#### getCurrentPeriod

  ```solidity
  function getCurrentPeriod() external view returns (uint256)
  ```

  Returns the current period type: Administration, Nomination, Voting, Evaluation

#### isNominated

  ```solidity
  function isNominated(address candidate) external view returns (bool)
  ```

  Shows if a candidate has been nominated in the current epoch

#### getNominees

  ```solidity
  function getNominees() external view returns (address[])
  ```

  Returns a list of all nominated candidates in the current epoch

#### calculateBallotId

  ```solidity
  function calculateBallotId(address[] candidates) external pure returns (bytes32)
  ```

  Hashes a list of candidates (used for identifying and storing ballots)

#### getBallotVoted

  ```solidity
  function getBallotVoted(address user) external view returns (bytes32)
  ```

  Returns the ballot id that user voted on in the current election

#### hasVoted

  ```solidity
  function hasVoted(address user) external view returns (bool)
  ```

  Returns if user has voted in the current election

#### getVotePower

  ```solidity
  function getVotePower(address user) external view returns (uint256)
  ```

  Returns the vote power of user in the current election

#### getBallotVotes

  ```solidity
  function getBallotVotes(bytes32 ballotId) external view returns (uint256)
  ```

  Returns the number of votes given to a particular ballot

#### getBallotCandidates

  ```solidity
  function getBallotCandidates(bytes32 ballotId) external view returns (address[])
  ```

  Returns the list of candidates that a particular ballot has

#### isElectionEvaluated

  ```solidity
  function isElectionEvaluated() external view returns (bool)
  ```

  Returns whether all ballots in the current election have been counted

#### getCandidateVotes

  ```solidity
  function getCandidateVotes(address candidate) external view returns (uint256)
  ```

  Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated

#### getElectionWinners

  ```solidity
  function getElectionWinners() external view returns (address[])
  ```

  Returns the winners of the current election. Requires the election to be partially or totally evaluated

#### getCouncilToken

  ```solidity
  function getCouncilToken() external view returns (address)
  ```

  Returns the address of the council NFT token

#### getCouncilMembers

  ```solidity
  function getCouncilMembers() external view returns (address[])
  ```

  Returns the current NFT token holders

## Oracle Manager

- [Back to TOC](#smart-contracts)

### Node Module

#### registerNode

  ```solidity
  function registerNode(enum NodeDefinition.NodeType nodeType, bytes parameters, bytes32[] parents) external returns (bytes32 nodeId)
  ```

  Registers a node

**Parameters**
* `nodeType` (*enum NodeDefinition.NodeType*) - The nodeType assigned to this node.
* `parameters` (*bytes*) - The parameters assigned to this node.
* `parents` (*bytes32[]*) - The parents assigned to this node.

**Returns**
* `nodeId` (*bytes32*) - The id of the registered node.
#### getNodeId

  ```solidity
  function getNodeId(enum NodeDefinition.NodeType nodeType, bytes parameters, bytes32[] parents) external returns (bytes32 nodeId)
  ```

  Returns the ID of a node, whether or not it has been registered.

**Parameters**
* `nodeType` (*enum NodeDefinition.NodeType*) - The nodeType assigned to this node.
* `parameters` (*bytes*) - The parameters assigned to this node.
* `parents` (*bytes32[]*) - The parents assigned to this node.

**Returns**
* `nodeId` (*bytes32*) - The id of the node.
#### getNode

  ```solidity
  function getNode(bytes32 nodeId) external pure returns (struct NodeDefinition.Data node)
  ```

  Returns a node's definition (type, parameters, and parents)

**Parameters**
* `nodeId` (*bytes32*) - The node ID

**Returns**
* `node` (*struct NodeDefinition.Data*) - The node's definition data
#### process

  ```solidity
  function process(bytes32 nodeId) external view returns (struct NodeOutput.Data node)
  ```

  Returns a node current output data

**Parameters**
* `nodeId` (*bytes32*) - The node ID

**Returns**
* `node` (*struct NodeOutput.Data*) - The node's output data

#### NodeRegistered

  ```solidity
  event NodeRegistered(bytes32 nodeId, enum NodeDefinition.NodeType nodeType, bytes parameters, bytes32[] parents)
  ```

  Emitted when `registerNode` is called.

**Parameters**
* `nodeId` (*bytes32*) - The id of the registered node.
* `nodeType` (*enum NodeDefinition.NodeType*) - The nodeType assigned to this node.
* `parameters` (*bytes*) - The parameters assigned to this node.
* `parents` (*bytes32[]*) - The parents assigned to this node.

### ChainlinkNode

#### process

  ```solidity
  function process(bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

#### getTwapPrice

  ```solidity
  function getTwapPrice(contract IAggregatorV3Interface chainlink, uint80 latestRoundId, int256 latestPrice, uint256 twapTimeInterval) internal view returns (int256 price)
  ```

#### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal view returns (bool valid)
  ```

### ConstantNode

#### process

  ```solidity
  function process(bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

#### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal pure returns (bool valid)
  ```

### ExternalNode

#### process

  ```solidity
  function process(struct NodeOutput.Data[] prices, bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

#### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal returns (bool valid)
  ```

### PriceDeviationCircuitBreakerNode

#### process

  ```solidity
  function process(struct NodeOutput.Data[] parentNodeOutputs, bytes parameters) internal pure returns (struct NodeOutput.Data nodeOutput)
  ```

#### abs

  ```solidity
  function abs(int256 x) private pure returns (int256 result)
  ```

#### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal pure returns (bool valid)
  ```

### PythNode

#### process

  ```solidity
  function process(bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

#### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal view returns (bool valid)
  ```

### ReducerNode

#### process

  ```solidity
  function process(struct NodeOutput.Data[] parentNodeOutputs, bytes parameters) internal pure returns (struct NodeOutput.Data nodeOutput)
  ```

#### median

  ```solidity
  function median(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data medianPrice)
  ```

#### mean

  ```solidity
  function mean(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data meanPrice)
  ```

#### recent

  ```solidity
  function recent(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data recentPrice)
  ```

#### max

  ```solidity
  function max(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data maxPrice)
  ```

#### min

  ```solidity
  function min(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data minPrice)
  ```

#### mul

  ```solidity
  function mul(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data mulPrice)
  ```

#### div

  ```solidity
  function div(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data divPrice)
  ```

#### quickSort

  ```solidity
  function quickSort(struct NodeOutput.Data[] arr, int256 left, int256 right) internal pure
  ```

#### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal pure returns (bool valid)
  ```

### StalenessCircuitBreakerNode

#### process

  ```solidity
  function process(struct NodeOutput.Data[] parentNodeOutputs, bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

#### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal pure returns (bool valid)
  ```

### UniswapNode

#### process

  ```solidity
  function process(bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

#### getQuoteAtTick

  ```solidity
  function getQuoteAtTick(int24 tick, uint256 baseAmount, address baseToken, address quoteToken) internal pure returns (uint256 quoteAmount)
  ```

#### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal view returns (bool valid)
  ```

