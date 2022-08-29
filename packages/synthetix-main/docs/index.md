# Solidity API

## Account Module

### AccountCreated

  ```solidity
  event AccountCreated(address sender, uint256 accountId)
  ```

  _Emitted when an account token with id `accountId` is minted to `sender`._

### RoleGranted

  ```solidity
  event RoleGranted(uint256 accountId, bytes32 role, address target, address sender)
  ```

  _Emitted when `target` is granted `role` by `sender` for account `accountId`._

### RoleRevoked

  ```solidity
  event RoleRevoked(uint256 accountId, bytes32 role, address target, address sender)
  ```

  _Emitted when `target` has `role` renounced or revoked by `sender` for account `accountId`._

### AccountPermission

```solidity
struct AccountPermission {
  address target;
  bytes32[] roles;
}
```
### getAccountPermissions

  ```solidity
  function getAccountPermissions(uint256 accountId) external view returns (struct IAccountModule.AccountPermission[])
  ```

  _Returns an array of `AccountPermission` for the provided `accountId`._

### createAccount

  ```solidity
  function createAccount(uint256 requestedAccountId) external
  ```

  _Mints an account token with id `requestedAccountId` to `msg.sender`.

Requirements:

- `requestedAccountId` must not already be minted.

Emits a {AccountCreated} event._

### grantRole

  ```solidity
  function grantRole(uint256 accountId, bytes32 role, address target) external
  ```

  _Grants `role` to `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" role.

Emits a {RoleGranted} event._

### revokeRole

  ```solidity
  function revokeRole(uint256 accountId, bytes32 role, address target) external
  ```

  _Revokes `role` from `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" role.

Emits a {RoleRevoked} event._

### renounceRole

  ```solidity
  function renounceRole(uint256 accountId, bytes32 role) external
  ```

  _Revokes `role` from `msg.sender` for account `accountId`.

Emits a {RoleRevoked} event._

### hasRole

  ```solidity
  function hasRole(uint256 accountId, bytes32 role, address target) external view returns (bool)
  ```

  _Returns `true` if `target` has been granted `role` for account `accountId`._

### getAccountTokenAddress

  ```solidity
  function getAccountTokenAddress() external view returns (address)
  ```

  _Returns the address for the account token used by the module._

### AccountCreated

  ```solidity
  event AccountCreated(address sender, uint256 accountId)
  ```

  _Emitted when an account token with id `accountId` is minted to `sender`._

### RoleGranted

  ```solidity
  event RoleGranted(uint256 accountId, bytes32 role, address target, address sender)
  ```

  _Emitted when `target` is granted `role` by `sender` for account `accountId`._

### RoleRevoked

  ```solidity
  event RoleRevoked(uint256 accountId, bytes32 role, address target, address sender)
  ```

  _Emitted when `target` has `role` renounced or revoked by `sender` for account `accountId`._

### AccountPermission

```solidity
struct AccountPermission {
  address target;
  bytes32[] roles;
}
```
### getAccountPermissions

  ```solidity
  function getAccountPermissions(uint256 accountId) external view returns (struct IAccountModule.AccountPermission[])
  ```

  _Returns an array of `AccountPermission` for the provided `accountId`._

### createAccount

  ```solidity
  function createAccount(uint256 requestedAccountId) external
  ```

  _Mints an account token with id `requestedAccountId` to `msg.sender`.

Requirements:

- `requestedAccountId` must not already be minted.

Emits a {AccountCreated} event._

### grantRole

  ```solidity
  function grantRole(uint256 accountId, bytes32 role, address target) external
  ```

  _Grants `role` to `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" role.

Emits a {RoleGranted} event._

### revokeRole

  ```solidity
  function revokeRole(uint256 accountId, bytes32 role, address target) external
  ```

  _Revokes `role` from `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" role.

Emits a {RoleRevoked} event._

### renounceRole

  ```solidity
  function renounceRole(uint256 accountId, bytes32 role) external
  ```

  _Revokes `role` from `msg.sender` for account `accountId`.

Emits a {RoleRevoked} event._

### hasRole

  ```solidity
  function hasRole(uint256 accountId, bytes32 role, address target) external view returns (bool)
  ```

  _Returns `true` if `target` has been granted `role` for account `accountId`._

### getAccountTokenAddress

  ```solidity
  function getAccountTokenAddress() external view returns (address)
  ```

  _Returns the address for the account token used by the module._

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

  _Mints a new token with the `requestedAccountId` as the ID, owned by `owner`

This function is only used internally by the system. See `createAccount` in the Account Module.

Requirements:

- `msg.sender` must be the owner of the contract.
- `requestedAccountId` must not already be minted.

Emits a {Mint} event._

### Mint

  ```solidity
  event Mint(address owner, uint256 tokenId)
  ```

  _Emitted when `tokenId` token is minted._

### mint

  ```solidity
  function mint(address owner, uint256 requestedAccountId) external
  ```

  _Mints a new token with the `requestedAccountId` as the ID, owned by `owner`

This function is only used internally by the system. See `createAccount` in the Account Module.

Requirements:

- `msg.sender` must be the owner of the contract.
- `requestedAccountId` must not already be minted.

Emits a {Mint} event._

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
Use along with {balanceOf} to enumerate all of ``owner``'s tokens._

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

  _Returns the number of tokens in ``owner``'s account._

### ownerOf

  ```solidity
  function ownerOf(uint256 tokenId) external view returns (address owner)
  ```

  _Returns the owner of the `tokenId` token.

Requirements:

- `tokenId` must exist._

### safeTransferFrom

  ```solidity
  function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external
  ```

  _Safely transfers `tokenId` token from `from` to `to`.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event._

### safeTransferFrom

  ```solidity
  function safeTransferFrom(address from, address to, uint256 tokenId) external
  ```

  _Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
are aware of the ERC721 protocol to prevent tokens from being forever locked.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must have been allowed to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event._

### transferFrom

  ```solidity
  function transferFrom(address from, address to, uint256 tokenId) external
  ```

  _Transfers `tokenId` token from `from` to `to`.

WARNING: Usage of this method is discouraged, use {safeTransferFrom} whenever possible.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.

Emits a {Transfer} event._

### approve

  ```solidity
  function approve(address to, uint256 tokenId) external
  ```

  _Gives permission to `to` to transfer `tokenId` token to another account.
The approval is cleared when the token is transferred.

Only a single account can be approved at a time, so approving the zero address clears previous approvals.

Requirements:

- The caller must own the token or be an approved operator.
- `tokenId` must exist.

Emits an {Approval} event._

### setApprovalForAll

  ```solidity
  function setApprovalForAll(address operator, bool approved) external
  ```

  _Approve or remove `operator` as an operator for the caller.
Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.

Requirements:

- The `operator` cannot be the caller.

Emits an {ApprovalForAll} event._

### getApproved

  ```solidity
  function getApproved(uint256 tokenId) external view returns (address operator)
  ```

  _Returns the account approved for `tokenId` token.

Requirements:

- `tokenId` must exist._

### isApprovedForAll

  ```solidity
  function isApprovedForAll(address owner, address operator) external view returns (bool)
  ```

  _Returns if the `operator` is allowed to manage all of the assets of `owner`.

See {setApprovalForAll}_

## Collateral Module

### adjustCollateralType

  ```solidity
  function adjustCollateralType(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled) external
  ```

SCCP Adds or Adjusts (can be enabled or re-enabled) a collateral type

### getCollateralTypes

  ```solidity
  function getCollateralTypes(bool hideDisabled) external view returns (struct CollateralStorage.CollateralData[] collaterals)
  ```

Gets a list of approved collateral types

### getCollateralType

  ```solidity
  function getCollateralType(address collateralType) external view returns (struct CollateralStorage.CollateralData collateral)
  ```

Gets the information of a particular approved collateral type

### stake

  ```solidity
  function stake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Stakes collateral for an account (by the account owner or an address with 'stake' role). Transfers the collateral from the account owner.

### unstake

  ```solidity
  function unstake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Unstakes collateral for an account (by the account owner or an address with 'unstake' role). Transfers the collateral to the account owner

### getAccountCollaterals

  ```solidity
  function getAccountCollaterals(uint256 accountId) external view returns (address[] collateralTypes)
  ```

Gets the list of collateral staked by an accountId

### getAccountCollateralTotals

  ```solidity
  function getAccountCollateralTotals(uint256 accountId, address collateralType) external view returns (uint256 totalStaked, uint256 totalAssigned, uint256 totalLocked, uint256 totalEscrowed)
  ```

Gets stats for an account staked collateral.

### getAccountUnstakebleCollateral

  ```solidity
  function getAccountUnstakebleCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Gets the account's free collateral of collateralType that can be unstaked.

### getAccountUnassignedCollateral

  ```solidity
  function getAccountUnassignedCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Gets the account's unassigned collateral of collateralType that can be assigned to a fund.

### cleanExpiredLocks

  ```solidity
  function cleanExpiredLocks(uint256 accountId, address collateralType, uint256 offset, uint256 items) external
  ```

Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)

### redeemReward

  ```solidity
  function redeemReward(uint256 accountId, uint256 amount, uint256 duration) external
  ```

Redeems the system escrow tokens into reward tokens

### adjustCollateralType

  ```solidity
  function adjustCollateralType(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled) external
  ```

SCCP Adds or Adjusts (can be enabled or re-enabled) a collateral type

### getCollateralTypes

  ```solidity
  function getCollateralTypes(bool hideDisabled) external view returns (struct CollateralStorage.CollateralData[] collaterals)
  ```

Gets a list of approved collateral types

### getCollateralType

  ```solidity
  function getCollateralType(address collateralType) external view returns (struct CollateralStorage.CollateralData collateral)
  ```

Gets the information of a particular approved collateral type

### stake

  ```solidity
  function stake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Stakes collateral for an account (by the account owner or an address with 'stake' role). Transfers the collateral from the account owner.

### unstake

  ```solidity
  function unstake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Unstakes collateral for an account (by the account owner or an address with 'unstake' role). Transfers the collateral to the account owner

### getAccountCollaterals

  ```solidity
  function getAccountCollaterals(uint256 accountId) external view returns (address[] collateralTypes)
  ```

Gets the list of collateral staked by an accountId

### getAccountCollateralTotals

  ```solidity
  function getAccountCollateralTotals(uint256 accountId, address collateralType) external view returns (uint256 totalStaked, uint256 totalAssigned, uint256 totalLocked, uint256 totalEscrowed)
  ```

Gets stats for an account staked collateral.

### getAccountUnstakebleCollateral

  ```solidity
  function getAccountUnstakebleCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Gets the account's free collateral of collateralType that can be unstaked.

### getAccountUnassignedCollateral

  ```solidity
  function getAccountUnassignedCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Gets the account's unassigned collateral of collateralType that can be assigned to a fund.

### cleanExpiredLocks

  ```solidity
  function cleanExpiredLocks(uint256 accountId, address collateralType, uint256 offset, uint256 items) external
  ```

Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)

### redeemReward

  ```solidity
  function redeemReward(uint256 accountId, uint256 amount, uint256 duration) external
  ```

Redeems the system escrow tokens into reward tokens

## Fund Configuration Module

### setPreferredFund

  ```solidity
  function setPreferredFund(uint256 fundId) external
  ```

SCCP sets the preferred fund

### addApprovedFund

  ```solidity
  function addApprovedFund(uint256 fundId) external
  ```

SCCP adds a fundId to the approved list

### removeApprovedFund

  ```solidity
  function removeApprovedFund(uint256 fundId) external
  ```

SCCP removes a fundId to the approved list

### getPreferredFund

  ```solidity
  function getPreferredFund() external view returns (uint256)
  ```

gets the preferred fund

### getApprovedFunds

  ```solidity
  function getApprovedFunds() external view returns (uint256[])
  ```

gets the approved funds (list of fundIds)

### setPreferredFund

  ```solidity
  function setPreferredFund(uint256 fundId) external
  ```

SCCP sets the preferred fund

### addApprovedFund

  ```solidity
  function addApprovedFund(uint256 fundId) external
  ```

SCCP adds a fundId to the approved list

### removeApprovedFund

  ```solidity
  function removeApprovedFund(uint256 fundId) external
  ```

SCCP removes a fundId to the approved list

### getPreferredFund

  ```solidity
  function getPreferredFund() external view returns (uint256)
  ```

gets the preferred fund

### getApprovedFunds

  ```solidity
  function getApprovedFunds() external view returns (uint256[])
  ```

gets the approved funds (list of fundIds)

## Fund Module

### createFund

  ```solidity
  function createFund(uint256 requestedFundId, address owner) external
  ```

creates a new fundToken (NFT)

### setFundPosition

  ```solidity
  function setFundPosition(uint256 fundId, uint256[] markets, uint256[] weights, int256[] maxDebtShareValues) external
  ```

sets the fund positions (only fundToken owner)

### getFundPosition

  ```solidity
  function getFundPosition(uint256 fundId) external view returns (uint256[] markets, uint256[] weights, int256[] maxDebtShareValues)
  ```

gets the fund positions

### setFundName

  ```solidity
  function setFundName(uint256 fundId, string name) external
  ```

sets the fund name

### getFundName

  ```solidity
  function getFundName(uint256 fundId) external view returns (string fundName)
  ```

gets the fund name

### nominateNewFundOwner

  ```solidity
  function nominateNewFundOwner(address nominatedOwner, uint256 fundId) external
  ```

nominates a new fund owner

### acceptFundOwnership

  ```solidity
  function acceptFundOwnership(uint256 fundId) external
  ```

accepts ownership by nominated owner

### renounceFundNomination

  ```solidity
  function renounceFundNomination(uint256 fundId) external
  ```

renounces ownership by nominated owner

### ownerOf

  ```solidity
  function ownerOf(uint256 fundId) external view returns (address)
  ```

gets owner of fundId

### nominatedOwnerOf

  ```solidity
  function nominatedOwnerOf(uint256 fundId) external view returns (address)
  ```

gets nominatedOwner of fundId

### createFund

  ```solidity
  function createFund(uint256 requestedFundId, address owner) external
  ```

creates a new fundToken (NFT)

### setFundPosition

  ```solidity
  function setFundPosition(uint256 fundId, uint256[] markets, uint256[] weights, int256[] maxDebtShareValues) external
  ```

sets the fund positions (only fundToken owner)

### getFundPosition

  ```solidity
  function getFundPosition(uint256 fundId) external view returns (uint256[] markets, uint256[] weights, int256[] maxDebtShareValues)
  ```

gets the fund positions

### setFundName

  ```solidity
  function setFundName(uint256 fundId, string name) external
  ```

sets the fund name

### getFundName

  ```solidity
  function getFundName(uint256 fundId) external view returns (string fundName)
  ```

gets the fund name

### nominateNewFundOwner

  ```solidity
  function nominateNewFundOwner(address nominatedOwner, uint256 fundId) external
  ```

nominates a new fund owner

### acceptFundOwnership

  ```solidity
  function acceptFundOwnership(uint256 fundId) external
  ```

accepts ownership by nominated owner

### renounceFundNomination

  ```solidity
  function renounceFundNomination(uint256 fundId) external
  ```

renounces ownership by nominated owner

### ownerOf

  ```solidity
  function ownerOf(uint256 fundId) external view returns (address)
  ```

gets owner of fundId

### nominatedOwnerOf

  ```solidity
  function nominatedOwnerOf(uint256 fundId) external view returns (address)
  ```

gets nominatedOwner of fundId

## Liquidation Module

### LiqudationInformation

```solidity
struct LiqudationInformation {
  struct CurvesLibrary.PolynomialCurve curve;
  mapping(uint256 => uint256) initialAmount;
  uint256 accumulated;
}
```
### liquidate

  ```solidity
  function liquidate(uint256 accountId, uint256 fundId, address collateralType) external returns (uint256 amountRewarded, uint256 debtLiquidated, uint256 collateralLiquidated)
  ```

liquidates the required collateral of the account delegated to the fundId

### liquidateVault

  ```solidity
  function liquidateVault(uint256 fundId, address collateralType) external returns (uint256 amountRewarded, uint256 collateralLiquidated)
  ```

liquidates an entire vault. can only be done if the vault itself is undercollateralized

### isLiquidatable

  ```solidity
  function isLiquidatable(uint256 accountId, uint256 fundId, address collateralType) external returns (bool)
  ```

returns if the account is liquidable on the fundId - collateralType pair

### LiqudationInformation

```solidity
struct LiqudationInformation {
  struct CurvesLibrary.PolynomialCurve curve;
  mapping(uint256 => uint256) initialAmount;
  uint256 accumulated;
}
```
### liquidate

  ```solidity
  function liquidate(uint256 accountId, uint256 fundId, address collateralType) external returns (uint256 amountRewarded, uint256 debtLiquidated, uint256 collateralLiquidated)
  ```

liquidates the required collateral of the account delegated to the fundId

### liquidateVault

  ```solidity
  function liquidateVault(uint256 fundId, address collateralType) external returns (uint256 amountRewarded, uint256 collateralLiquidated)
  ```

liquidates an entire vault. can only be done if the vault itself is undercollateralized

### isLiquidatable

  ```solidity
  function isLiquidatable(uint256 accountId, uint256 fundId, address collateralType) external returns (bool)
  ```

returns if the account is liquidable on the fundId - collateralType pair

## Market Manager Module

### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint256)
  ```

registers a new market

### marketLiquidity

  ```solidity
  function marketLiquidity(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### marketTotalBalance

  ```solidity
  function marketTotalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market

### deposit

  ```solidity
  function deposit(uint256 marketId, address target, uint256 amount) external
  ```

target deposits amount of synths to the marketId

### withdraw

  ```solidity
  function withdraw(uint256 marketId, address target, uint256 amount) external
  ```

target withdraws amount of synths to the marketId

### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint256)
  ```

registers a new market

### marketLiquidity

  ```solidity
  function marketLiquidity(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### marketTotalBalance

  ```solidity
  function marketTotalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market

### deposit

  ```solidity
  function deposit(uint256 marketId, address target, uint256 amount) external
  ```

target deposits amount of synths to the marketId

### withdraw

  ```solidity
  function withdraw(uint256 marketId, address target, uint256 amount) external
  ```

target withdraws amount of synths to the marketId

## Multicall Module

### multicall

  ```solidity
  function multicall(bytes[] data) external payable returns (bytes[] results)
  ```

### multicall

  ```solidity
  function multicall(bytes[] data) external payable returns (bytes[] results)
  ```

## Reward Distributor Module

### setRewardAllocation

  ```solidity
  function setRewardAllocation(uint256 fundId, uint256 allocation) external
  ```

### getRewardAllocation

  ```solidity
  function getRewardAllocation(uint256 fundId) external view returns (uint256)
  ```

### setRewardAllocation

  ```solidity
  function setRewardAllocation(uint256 fundId, uint256 allocation) external
  ```

### getRewardAllocation

  ```solidity
  function getRewardAllocation(uint256 fundId) external view returns (uint256)
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

### delegateCollateral

  ```solidity
  function delegateCollateral(uint256 accountId, uint256 fundId, address collateralType, uint256 amount, uint256 leverage) external
  ```

delegates (creates, adjust or remove a delegation) collateral from an account

### mintUSD

  ```solidity
  function mintUSD(uint256 accountId, uint256 fundId, address collateralType, uint256 amount) external
  ```

mints USD for a fund/account from a collateralType. if CRatio is valid

### burnUSD

  ```solidity
  function burnUSD(uint256 accountId, uint256 fundId, address collateralType, uint256 amount) external
  ```

burns USD for a fund/account from a collateralType

### accountCollateralRatio

  ```solidity
  function accountCollateralRatio(uint256 accountId, uint256 fundId, address collateralType) external returns (uint256)
  ```

gets the CRatio for an account/collateral in a fund

### accountVaultDebt

  ```solidity
  function accountVaultDebt(uint256 accountId, uint256 fundId, address collateralType) external returns (int256)
  ```

gets the account debt in a fund for a collateral

### accountVaultCollateral

  ```solidity
  function accountVaultCollateral(uint256 accountId, uint256 fundId, address collateralType) external view returns (uint256 amount, uint256 value, uint256 shares)
  ```

gets the account collateral value in a fund for a collateral

### vaultDebt

  ```solidity
  function vaultDebt(uint256 fundId, address collateralType) external returns (int256)
  ```

gets the total fund debt

### vaultCollateral

  ```solidity
  function vaultCollateral(uint256 fundId, address collateralType) external returns (uint256 amount, uint256 value)
  ```

gets total vault collateral and its value

### totalVaultShares

  ```solidity
  function totalVaultShares(uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the total fund debtShares

### debtPerShare

  ```solidity
  function debtPerShare(uint256 fundId, address collateralType) external returns (int256)
  ```

gets the debt per share (USD value) for a fund

### getLiquidityItem

  ```solidity
  function getLiquidityItem(bytes32 liquidityItemId) external view returns (struct FundVaultStorage.LiquidityItem liquidityItem)
  ```

gets liquidityItem details for a liquidityItemId

### delegateCollateral

  ```solidity
  function delegateCollateral(uint256 accountId, uint256 fundId, address collateralType, uint256 amount, uint256 leverage) external
  ```

delegates (creates, adjust or remove a delegation) collateral from an account

### mintUSD

  ```solidity
  function mintUSD(uint256 accountId, uint256 fundId, address collateralType, uint256 amount) external
  ```

mints USD for a fund/account from a collateralType. if CRatio is valid

### burnUSD

  ```solidity
  function burnUSD(uint256 accountId, uint256 fundId, address collateralType, uint256 amount) external
  ```

burns USD for a fund/account from a collateralType

### accountCollateralRatio

  ```solidity
  function accountCollateralRatio(uint256 accountId, uint256 fundId, address collateralType) external returns (uint256)
  ```

gets the CRatio for an account/collateral in a fund

### accountVaultDebt

  ```solidity
  function accountVaultDebt(uint256 accountId, uint256 fundId, address collateralType) external returns (int256)
  ```

gets the account debt in a fund for a collateral

### accountVaultCollateral

  ```solidity
  function accountVaultCollateral(uint256 accountId, uint256 fundId, address collateralType) external view returns (uint256 amount, uint256 value, uint256 shares)
  ```

gets the account collateral value in a fund for a collateral

### vaultDebt

  ```solidity
  function vaultDebt(uint256 fundId, address collateralType) external returns (int256)
  ```

gets the total fund debt

### vaultCollateral

  ```solidity
  function vaultCollateral(uint256 fundId, address collateralType) external returns (uint256 amount, uint256 value)
  ```

gets total vault collateral and its value

### totalVaultShares

  ```solidity
  function totalVaultShares(uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the total fund debtShares

### debtPerShare

  ```solidity
  function debtPerShare(uint256 fundId, address collateralType) external returns (int256)
  ```

gets the debt per share (USD value) for a fund

### getLiquidityItem

  ```solidity
  function getLiquidityItem(bytes32 liquidityItemId) external view returns (struct FundVaultStorage.LiquidityItem liquidityItem)
  ```

gets liquidityItem details for a liquidityItemId

## Vault Module Storage

### LiquidityItem

```solidity
struct LiquidityItem {
  uint256 accountId;
  address collateralType;
  uint256 fundId;
  uint256 collateralAmount;
  uint256 shares;
  uint256 initialDebt;
  uint256 leverage;
}
```

### LiquidityItem

```solidity
struct LiquidityItem {
  uint256 accountId;
  address collateralType;
  uint256 fundId;
  uint256 collateralAmount;
  uint256 shares;
  uint256 initialDebt;
  uint256 leverage;
}
```

## Vault Rewards Module

### distributeRewards

  ```solidity
  function distributeRewards(uint256 fundId, address token, uint256 index, address distributor, uint256 amount, uint256 start, uint256 duration) external
  ```

called by fund owner or an existing distributor to set up rewards for vault participants

### getAvailableRewards

  ```solidity
  function getAvailableRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards.
this function should be called to get currently available rewards using `callStatic`

### claimRewards

  ```solidity
  function claimRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards, and claims them to the caller's account.
this function should be called to get currently available rewards using `callStatic`

### getCurrentRewardAccumulation

  ```solidity
  function getCurrentRewardAccumulation(uint256 fundId, address collateralType) external view returns (uint256[])
  ```

returns the number of individual units of amount emitted per second per share for the given fundId, collateralType vault

### distributeRewards

  ```solidity
  function distributeRewards(uint256 fundId, address token, uint256 index, address distributor, uint256 amount, uint256 start, uint256 duration) external
  ```

called by fund owner or an existing distributor to set up rewards for vault participants

### getAvailableRewards

  ```solidity
  function getAvailableRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards.
this function should be called to get currently available rewards using `callStatic`

### claimRewards

  ```solidity
  function claimRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards, and claims them to the caller's account.
this function should be called to get currently available rewards using `callStatic`

### getCurrentRewardAccumulation

  ```solidity
  function getCurrentRewardAccumulation(uint256 fundId, address collateralType) external view returns (uint256[])
  ```

returns the number of individual units of amount emitted per second per share for the given fundId, collateralType vault

## Account Module

### AccountCreated

  ```solidity
  event AccountCreated(address sender, uint256 accountId)
  ```

Emitted when an account token with id `accountId` is minted to `sender`.

### RoleGranted

  ```solidity
  event RoleGranted(uint256 accountId, bytes32 role, address target, address sender)
  ```

Emitted when `target` is granted `role` by `sender` for account `accountId`.

### RoleRevoked

  ```solidity
  event RoleRevoked(uint256 accountId, bytes32 role, address target, address sender)
  ```

Emitted when `target` has `role` renounced or revoked by `sender` for account `accountId`.

### AccountPermission

```solidity
struct AccountPermission {
  address target;
  bytes32[] roles;
}
```
### getAccountPermissions

  ```solidity
  function getAccountPermissions(uint256 accountId) external view returns (struct IAccountModule.AccountPermission[])
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

### grantRole

  ```solidity
  function grantRole(uint256 accountId, bytes32 role, address target) external
  ```

Grants `role` to `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" role.

Emits a {RoleGranted} event.

### revokeRole

  ```solidity
  function revokeRole(uint256 accountId, bytes32 role, address target) external
  ```

Revokes `role` from `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" role.

Emits a {RoleRevoked} event.

### renounceRole

  ```solidity
  function renounceRole(uint256 accountId, bytes32 role) external
  ```

Revokes `role` from `msg.sender` for account `accountId`.

Emits a {RoleRevoked} event.

### hasRole

  ```solidity
  function hasRole(uint256 accountId, bytes32 role, address target) external view returns (bool)
  ```

Returns `true` if `target` has been granted `role` for account `accountId`.

### getAccountTokenAddress

  ```solidity
  function getAccountTokenAddress() external view returns (address)
  ```

Returns the address for the account token used by the module.

### AccountCreated

  ```solidity
  event AccountCreated(address sender, uint256 accountId)
  ```

Emitted when an account token with id `accountId` is minted to `sender`.

### RoleGranted

  ```solidity
  event RoleGranted(uint256 accountId, bytes32 role, address target, address sender)
  ```

Emitted when `target` is granted `role` by `sender` for account `accountId`.

### RoleRevoked

  ```solidity
  event RoleRevoked(uint256 accountId, bytes32 role, address target, address sender)
  ```

Emitted when `target` has `role` renounced or revoked by `sender` for account `accountId`.

### AccountPermission

```solidity
struct AccountPermission {
  address target;
  bytes32[] roles;
}
```
### getAccountPermissions

  ```solidity
  function getAccountPermissions(uint256 accountId) external view returns (struct IAccountModule.AccountPermission[])
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

### grantRole

  ```solidity
  function grantRole(uint256 accountId, bytes32 role, address target) external
  ```

Grants `role` to `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" role.

Emits a {RoleGranted} event.

### revokeRole

  ```solidity
  function revokeRole(uint256 accountId, bytes32 role, address target) external
  ```

Revokes `role` from `target` for account `accountId`.

Requirements:

- `msg.sender` must own the account token with ID `accountId` or have the "admin" role.

Emits a {RoleRevoked} event.

### renounceRole

  ```solidity
  function renounceRole(uint256 accountId, bytes32 role) external
  ```

Revokes `role` from `msg.sender` for account `accountId`.

Emits a {RoleRevoked} event.

### hasRole

  ```solidity
  function hasRole(uint256 accountId, bytes32 role, address target) external view returns (bool)
  ```

Returns `true` if `target` has been granted `role` for account `accountId`.

### getAccountTokenAddress

  ```solidity
  function getAccountTokenAddress() external view returns (address)
  ```

Returns the address for the account token used by the module.

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

  _Mints a new token with the `requestedAccountId` as the ID, owned by `owner`

This function is only used internally by the system. See `createAccount` in the Account Module.

Requirements:

- `msg.sender` must be the owner of the contract.
- `requestedAccountId` must not already be minted.

Emits a {Mint} event._

### Mint

  ```solidity
  event Mint(address owner, uint256 tokenId)
  ```

  _Emitted when `tokenId` token is minted._

### mint

  ```solidity
  function mint(address owner, uint256 requestedAccountId) external
  ```

  _Mints a new token with the `requestedAccountId` as the ID, owned by `owner`

This function is only used internally by the system. See `createAccount` in the Account Module.

Requirements:

- `msg.sender` must be the owner of the contract.
- `requestedAccountId` must not already be minted.

Emits a {Mint} event._

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
Use along with {balanceOf} to enumerate all of ``owner``'s tokens._

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

  _Returns the number of tokens in ``owner``'s account._

### ownerOf

  ```solidity
  function ownerOf(uint256 tokenId) external view returns (address owner)
  ```

  _Returns the owner of the `tokenId` token.

Requirements:

- `tokenId` must exist._

### safeTransferFrom

  ```solidity
  function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external
  ```

  _Safely transfers `tokenId` token from `from` to `to`.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event._

### safeTransferFrom

  ```solidity
  function safeTransferFrom(address from, address to, uint256 tokenId) external
  ```

  _Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
are aware of the ERC721 protocol to prevent tokens from being forever locked.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must have been allowed to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event._

### transferFrom

  ```solidity
  function transferFrom(address from, address to, uint256 tokenId) external
  ```

  _Transfers `tokenId` token from `from` to `to`.

WARNING: Usage of this method is discouraged, use {safeTransferFrom} whenever possible.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.

Emits a {Transfer} event._

### approve

  ```solidity
  function approve(address to, uint256 tokenId) external
  ```

  _Gives permission to `to` to transfer `tokenId` token to another account.
The approval is cleared when the token is transferred.

Only a single account can be approved at a time, so approving the zero address clears previous approvals.

Requirements:

- The caller must own the token or be an approved operator.
- `tokenId` must exist.

Emits an {Approval} event._

### setApprovalForAll

  ```solidity
  function setApprovalForAll(address operator, bool approved) external
  ```

  _Approve or remove `operator` as an operator for the caller.
Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.

Requirements:

- The `operator` cannot be the caller.

Emits an {ApprovalForAll} event._

### getApproved

  ```solidity
  function getApproved(uint256 tokenId) external view returns (address operator)
  ```

  _Returns the account approved for `tokenId` token.

Requirements:

- `tokenId` must exist._

### isApprovedForAll

  ```solidity
  function isApprovedForAll(address owner, address operator) external view returns (bool)
  ```

  _Returns if the `operator` is allowed to manage all of the assets of `owner`.

See {setApprovalForAll}_

## Collateral Module

### CollateralConfigured

  ```solidity
  event CollateralConfigured(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled)
  ```

Emitted when a collateral type’s configuration is created or updated.

### CollateralStaked

  ```solidity
  event CollateralStaked(uint256 accountId, address collateralType, uint256 amount, address sender)
  ```

Emitted when `amount` of collateral of type `collateralType` is staked to account `accountId` by `sender`.

### CollateralUnstaked

  ```solidity
  event CollateralUnstaked(uint256 accountId, address collateralType, uint256 amount, address sender)
  ```

Emitted when `amount` of collateral of type `collateralType` is unstaked from account `accountId` by `sender`.

### adjustCollateralType

  ```solidity
  function adjustCollateralType(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled) external
  ```

Creates or updates the configuration for given `collateralType`.

Requirements:

- `msg.sender` must be the owner of the system.

Emits a {CollateralConfigured} event.

### getCollateralTypes

  ```solidity
  function getCollateralTypes(bool hideDisabled) external view returns (struct CollateralStorage.CollateralData[] collaterals)
  ```

Returns a list of detailed information pertaining to all collateral types registered in the system.

### getCollateralType

  ```solidity
  function getCollateralType(address collateralType) external view returns (struct CollateralStorage.CollateralData collateral)
  ```

Returns detailed information pertaining the specified collateral type.

### stake

  ```solidity
  function stake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Stakes `amount` of collateral of type `collateralType` into account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `STAKE` permission.

Emits a {CollateralStaked} event.

### unstake

  ```solidity
  function unstake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Unstakes `amount` of collateral of type `collateralType` from account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `UNSTAKE` permission.

Emits a {CollateralUnstaked} event.

### getAccountCollateral

  ```solidity
  function getAccountCollateral(uint256 accountId, address collateralType) external view returns (uint256 totalStaked, uint256 totalAssigned, uint256 totalLocked, uint256 totalEscrowed)
  ```

Returns the total values pertaining to account `accountId` for `collateralType`.

### getAccountUnstakebleCollateral

  ```solidity
  function getAccountUnstakebleCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be unstaked.

  _DEPENDENT ON 305 (Would be combined with `getAccountUnstakebleCollateral` into `getAccountAvailableCollateral`)_

### getAccountUnassignedCollateral

  ```solidity
  function getAccountUnassignedCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be delegated to a pool.

  _DEPENDENT ON 305 (Would be combined with `getAccountUnstakebleCollateral` into `getAccountAvailableCollateral`)_

### cleanExpiredLocks

  ```solidity
  function cleanExpiredLocks(uint256 accountId, address collateralType, uint256 offset, uint256 items) external
  ```

Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)

  _DEPENDENT ON 305_

### redeemReward

  ```solidity
  function redeemReward(uint256 accountId, uint256 amount, uint256 duration) external
  ```

Redeems the system escrow tokens into reward tokens

  _DEPENDENT ON 305_

### CollateralConfigured

  ```solidity
  event CollateralConfigured(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled)
  ```

Emitted when a collateral type’s configuration is created or updated.

### CollateralStaked

  ```solidity
  event CollateralStaked(uint256 accountId, address collateralType, uint256 amount, address sender)
  ```

Emitted when `amount` of collateral of type `collateralType` is staked to account `accountId` by `sender`.

### CollateralUnstaked

  ```solidity
  event CollateralUnstaked(uint256 accountId, address collateralType, uint256 amount, address sender)
  ```

Emitted when `amount` of collateral of type `collateralType` is unstaked from account `accountId` by `sender`.

### adjustCollateralType

  ```solidity
  function adjustCollateralType(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled) external
  ```

Creates or updates the configuration for given `collateralType`.

Requirements:

- `msg.sender` must be the owner of the system.

Emits a {CollateralConfigured} event.

### getCollateralTypes

  ```solidity
  function getCollateralTypes(bool hideDisabled) external view returns (struct CollateralStorage.CollateralData[] collaterals)
  ```

Returns a list of detailed information pertaining to all collateral types registered in the system.

### getCollateralType

  ```solidity
  function getCollateralType(address collateralType) external view returns (struct CollateralStorage.CollateralData collateral)
  ```

Returns detailed information pertaining the specified collateral type.

### stake

  ```solidity
  function stake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Stakes `amount` of collateral of type `collateralType` into account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `STAKE` permission.

Emits a {CollateralStaked} event.

### unstake

  ```solidity
  function unstake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Unstakes `amount` of collateral of type `collateralType` from account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `UNSTAKE` permission.

Emits a {CollateralUnstaked} event.

### getAccountCollateral

  ```solidity
  function getAccountCollateral(uint256 accountId, address collateralType) external view returns (uint256 totalStaked, uint256 totalAssigned, uint256 totalLocked, uint256 totalEscrowed)
  ```

Returns the total values pertaining to account `accountId` for `collateralType`.

### getAccountUnstakebleCollateral

  ```solidity
  function getAccountUnstakebleCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be unstaked.

  _DEPENDENT ON 305 (Would be combined with `getAccountUnstakebleCollateral` into `getAccountAvailableCollateral`)_

### getAccountUnassignedCollateral

  ```solidity
  function getAccountUnassignedCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be delegated to a pool.

  _DEPENDENT ON 305 (Would be combined with `getAccountUnstakebleCollateral` into `getAccountAvailableCollateral`)_

### cleanExpiredLocks

  ```solidity
  function cleanExpiredLocks(uint256 accountId, address collateralType, uint256 offset, uint256 items) external
  ```

Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)

  _DEPENDENT ON 305_

### redeemReward

  ```solidity
  function redeemReward(uint256 accountId, uint256 amount, uint256 duration) external
  ```

Redeems the system escrow tokens into reward tokens

  _DEPENDENT ON 305_

## Collateral Module

### CollateralConfigured

  ```solidity
  event CollateralConfigured(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled)
  ```

Emitted when a collateral type’s configuration is created or updated.

### CollateralStaked

  ```solidity
  event CollateralStaked(uint256 accountId, address collateralType, uint256 amount, address sender)
  ```

Emitted when `amount` of collateral of type `collateralType` is staked to account `accountId` by `sender`.

### CollateralUnstaked

  ```solidity
  event CollateralUnstaked(uint256 accountId, address collateralType, uint256 amount, address sender)
  ```

Emitted when `amount` of collateral of type `collateralType` is unstaked from account `accountId` by `sender`.

### adjustCollateralType

  ```solidity
  function adjustCollateralType(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled) external
  ```

Creates or updates the configuration for given `collateralType`.

Requirements:

- `msg.sender` must be the owner of the system.

Emits a {CollateralConfigured} event.

### getCollateralTypes

  ```solidity
  function getCollateralTypes(bool hideDisabled) external view returns (struct CollateralStorage.CollateralData[] collaterals)
  ```

Returns a list of detailed information pertaining to all collateral types registered in the system.

### getCollateralType

  ```solidity
  function getCollateralType(address collateralType) external view returns (struct CollateralStorage.CollateralData collateral)
  ```

Returns detailed information pertaining the specified collateral type.

### stake

  ```solidity
  function stake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Stakes `amount` of collateral of type `collateralType` into account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `STAKE` permission.

Emits a {CollateralStaked} event.

### unstake

  ```solidity
  function unstake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Unstakes `amount` of collateral of type `collateralType` from account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `UNSTAKE` permission.

Emits a {CollateralUnstaked} event.

### getAccountCollateral

  ```solidity
  function getAccountCollateral(uint256 accountId, address collateralType) external view returns (uint256 totalStaked, uint256 totalAssigned)
  ```

Returns the total values pertaining to account `accountId` for `collateralType`.

### getAccountAvailableCollateral

  ```solidity
  function getAccountAvailableCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be unstaked or delegated.

### CollateralConfigured

  ```solidity
  event CollateralConfigured(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled)
  ```

Emitted when a collateral type’s configuration is created or updated.

### CollateralStaked

  ```solidity
  event CollateralStaked(uint256 accountId, address collateralType, uint256 amount, address sender)
  ```

Emitted when `amount` of collateral of type `collateralType` is staked to account `accountId` by `sender`.

### CollateralUnstaked

  ```solidity
  event CollateralUnstaked(uint256 accountId, address collateralType, uint256 amount, address sender)
  ```

Emitted when `amount` of collateral of type `collateralType` is unstaked from account `accountId` by `sender`.

### adjustCollateralType

  ```solidity
  function adjustCollateralType(address collateralType, address priceFeed, uint256 targetCRatio, uint256 minimumCRatio, bool enabled) external
  ```

Creates or updates the configuration for given `collateralType`.

Requirements:

- `msg.sender` must be the owner of the system.

Emits a {CollateralConfigured} event.

### getCollateralTypes

  ```solidity
  function getCollateralTypes(bool hideDisabled) external view returns (struct CollateralStorage.CollateralData[] collaterals)
  ```

Returns a list of detailed information pertaining to all collateral types registered in the system.

### getCollateralType

  ```solidity
  function getCollateralType(address collateralType) external view returns (struct CollateralStorage.CollateralData collateral)
  ```

Returns detailed information pertaining the specified collateral type.

### stake

  ```solidity
  function stake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Stakes `amount` of collateral of type `collateralType` into account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `STAKE` permission.

Emits a {CollateralStaked} event.

### unstake

  ```solidity
  function unstake(uint256 accountId, address collateralType, uint256 amount) external
  ```

Unstakes `amount` of collateral of type `collateralType` from account `accountId`.

Requirements:

- `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `UNSTAKE` permission.

Emits a {CollateralUnstaked} event.

### getAccountCollateral

  ```solidity
  function getAccountCollateral(uint256 accountId, address collateralType) external view returns (uint256 totalStaked, uint256 totalAssigned)
  ```

Returns the total values pertaining to account `accountId` for `collateralType`.

### getAccountAvailableCollateral

  ```solidity
  function getAccountAvailableCollateral(uint256 accountId, address collateralType) external view returns (uint256)
  ```

Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be unstaked or delegated.

## Fund Configuration Module

### setPreferredFund

  ```solidity
  function setPreferredFund(uint256 fundId) external
  ```

SCCP sets the preferred fund

### addApprovedFund

  ```solidity
  function addApprovedFund(uint256 fundId) external
  ```

SCCP adds a fundId to the approved list

### removeApprovedFund

  ```solidity
  function removeApprovedFund(uint256 fundId) external
  ```

SCCP removes a fundId to the approved list

### getPreferredFund

  ```solidity
  function getPreferredFund() external view returns (uint256)
  ```

gets the preferred fund

### getApprovedFunds

  ```solidity
  function getApprovedFunds() external view returns (uint256[])
  ```

gets the approved funds (list of fundIds)

### setPreferredFund

  ```solidity
  function setPreferredFund(uint256 fundId) external
  ```

SCCP sets the preferred fund

### addApprovedFund

  ```solidity
  function addApprovedFund(uint256 fundId) external
  ```

SCCP adds a fundId to the approved list

### removeApprovedFund

  ```solidity
  function removeApprovedFund(uint256 fundId) external
  ```

SCCP removes a fundId to the approved list

### getPreferredFund

  ```solidity
  function getPreferredFund() external view returns (uint256)
  ```

gets the preferred fund

### getApprovedFunds

  ```solidity
  function getApprovedFunds() external view returns (uint256[])
  ```

gets the approved funds (list of fundIds)

## Fund Module

### createFund

  ```solidity
  function createFund(uint256 requestedFundId, address owner) external
  ```

creates a new fundToken (NFT)

### setFundPosition

  ```solidity
  function setFundPosition(uint256 fundId, uint256[] markets, uint256[] weights, int256[] maxDebtShareValues) external
  ```

sets the fund positions (only fundToken owner)

### getFundPosition

  ```solidity
  function getFundPosition(uint256 fundId) external view returns (uint256[] markets, uint256[] weights, int256[] maxDebtShareValues)
  ```

gets the fund positions

### setFundName

  ```solidity
  function setFundName(uint256 fundId, string name) external
  ```

sets the fund name

### getFundName

  ```solidity
  function getFundName(uint256 fundId) external view returns (string fundName)
  ```

gets the fund name

### nominateNewFundOwner

  ```solidity
  function nominateNewFundOwner(address nominatedOwner, uint256 fundId) external
  ```

nominates a new fund owner

### acceptFundOwnership

  ```solidity
  function acceptFundOwnership(uint256 fundId) external
  ```

accepts ownership by nominated owner

### renounceFundNomination

  ```solidity
  function renounceFundNomination(uint256 fundId) external
  ```

renounces ownership by nominated owner

### ownerOf

  ```solidity
  function ownerOf(uint256 fundId) external view returns (address)
  ```

gets owner of fundId

### nominatedOwnerOf

  ```solidity
  function nominatedOwnerOf(uint256 fundId) external view returns (address)
  ```

gets nominatedOwner of fundId

### createFund

  ```solidity
  function createFund(uint256 requestedFundId, address owner) external
  ```

creates a new fundToken (NFT)

### setFundPosition

  ```solidity
  function setFundPosition(uint256 fundId, uint256[] markets, uint256[] weights, int256[] maxDebtShareValues) external
  ```

sets the fund positions (only fundToken owner)

### getFundPosition

  ```solidity
  function getFundPosition(uint256 fundId) external view returns (uint256[] markets, uint256[] weights, int256[] maxDebtShareValues)
  ```

gets the fund positions

### setFundName

  ```solidity
  function setFundName(uint256 fundId, string name) external
  ```

sets the fund name

### getFundName

  ```solidity
  function getFundName(uint256 fundId) external view returns (string fundName)
  ```

gets the fund name

### nominateNewFundOwner

  ```solidity
  function nominateNewFundOwner(address nominatedOwner, uint256 fundId) external
  ```

nominates a new fund owner

### acceptFundOwnership

  ```solidity
  function acceptFundOwnership(uint256 fundId) external
  ```

accepts ownership by nominated owner

### renounceFundNomination

  ```solidity
  function renounceFundNomination(uint256 fundId) external
  ```

renounces ownership by nominated owner

### ownerOf

  ```solidity
  function ownerOf(uint256 fundId) external view returns (address)
  ```

gets owner of fundId

### nominatedOwnerOf

  ```solidity
  function nominatedOwnerOf(uint256 fundId) external view returns (address)
  ```

gets nominatedOwner of fundId

## Liquidation Module

### LiqudationInformation

```solidity
struct LiqudationInformation {
  struct CurvesLibrary.PolynomialCurve curve;
  mapping(uint256 => uint256) initialAmount;
  uint256 accumulated;
}
```
### liquidate

  ```solidity
  function liquidate(uint256 accountId, uint256 fundId, address collateralType) external returns (uint256 amountRewarded, uint256 debtLiquidated, uint256 collateralLiquidated)
  ```

liquidates the required collateral of the account delegated to the fundId

### liquidateVault

  ```solidity
  function liquidateVault(uint256 fundId, address collateralType) external returns (uint256 amountRewarded, uint256 collateralLiquidated)
  ```

liquidates an entire vault. can only be done if the vault itself is undercollateralized

### isLiquidatable

  ```solidity
  function isLiquidatable(uint256 accountId, uint256 fundId, address collateralType) external returns (bool)
  ```

returns if the account is liquidable on the fundId - collateralType pair

### LiqudationInformation

```solidity
struct LiqudationInformation {
  struct CurvesLibrary.PolynomialCurve curve;
  mapping(uint256 => uint256) initialAmount;
  uint256 accumulated;
}
```
### liquidate

  ```solidity
  function liquidate(uint256 accountId, uint256 fundId, address collateralType) external returns (uint256 amountRewarded, uint256 debtLiquidated, uint256 collateralLiquidated)
  ```

liquidates the required collateral of the account delegated to the fundId

### liquidateVault

  ```solidity
  function liquidateVault(uint256 fundId, address collateralType) external returns (uint256 amountRewarded, uint256 collateralLiquidated)
  ```

liquidates an entire vault. can only be done if the vault itself is undercollateralized

### isLiquidatable

  ```solidity
  function isLiquidatable(uint256 accountId, uint256 fundId, address collateralType) external returns (bool)
  ```

returns if the account is liquidable on the fundId - collateralType pair

## Market Manager Module

### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint256)
  ```

registers a new market

### marketLiquidity

  ```solidity
  function marketLiquidity(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### marketTotalBalance

  ```solidity
  function marketTotalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market

### deposit

  ```solidity
  function deposit(uint256 marketId, address target, uint256 amount) external
  ```

target deposits amount of synths to the marketId

### withdraw

  ```solidity
  function withdraw(uint256 marketId, address target, uint256 amount) external
  ```

target withdraws amount of synths to the marketId

### registerMarket

  ```solidity
  function registerMarket(address market) external returns (uint256)
  ```

registers a new market

### marketLiquidity

  ```solidity
  function marketLiquidity(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### marketTotalBalance

  ```solidity
  function marketTotalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market

### deposit

  ```solidity
  function deposit(uint256 marketId, address target, uint256 amount) external
  ```

target deposits amount of synths to the marketId

### withdraw

  ```solidity
  function withdraw(uint256 marketId, address target, uint256 amount) external
  ```

target withdraws amount of synths to the marketId

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

### delegateCollateral

  ```solidity
  function delegateCollateral(uint256 accountId, uint256 fundId, address collateralType, uint256 amount, uint256 leverage) external
  ```

delegates (creates, adjust or remove a delegation) collateral from an account

### mintUSD

  ```solidity
  function mintUSD(uint256 accountId, uint256 fundId, address collateralType, uint256 amount) external
  ```

mints USD for a fund/account from a collateralType. if CRatio is valid

### burnUSD

  ```solidity
  function burnUSD(uint256 accountId, uint256 fundId, address collateralType, uint256 amount) external
  ```

burns USD for a fund/account from a collateralType

### accountCollateralRatio

  ```solidity
  function accountCollateralRatio(uint256 accountId, uint256 fundId, address collateralType) external returns (uint256)
  ```

gets the CRatio for an account/collateral in a fund

### accountVaultDebt

  ```solidity
  function accountVaultDebt(uint256 accountId, uint256 fundId, address collateralType) external returns (int256)
  ```

gets the account debt in a fund for a collateral

### accountVaultCollateral

  ```solidity
  function accountVaultCollateral(uint256 accountId, uint256 fundId, address collateralType) external view returns (uint256 amount, uint256 value, uint256 shares)
  ```

gets the account collateral value in a fund for a collateral

### vaultDebt

  ```solidity
  function vaultDebt(uint256 fundId, address collateralType) external returns (int256)
  ```

gets the total fund debt

### vaultCollateral

  ```solidity
  function vaultCollateral(uint256 fundId, address collateralType) external returns (uint256 amount, uint256 value)
  ```

gets total vault collateral and its value

### totalVaultShares

  ```solidity
  function totalVaultShares(uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the total fund debtShares

### debtPerShare

  ```solidity
  function debtPerShare(uint256 fundId, address collateralType) external returns (int256)
  ```

gets the debt per share (USD value) for a fund

### getLiquidityItem

  ```solidity
  function getLiquidityItem(bytes32 liquidityItemId) external view returns (struct FundVaultStorage.LiquidityItem liquidityItem)
  ```

gets liquidityItem details for a liquidityItemId

### delegateCollateral

  ```solidity
  function delegateCollateral(uint256 accountId, uint256 fundId, address collateralType, uint256 amount, uint256 leverage) external
  ```

delegates (creates, adjust or remove a delegation) collateral from an account

### mintUSD

  ```solidity
  function mintUSD(uint256 accountId, uint256 fundId, address collateralType, uint256 amount) external
  ```

mints USD for a fund/account from a collateralType. if CRatio is valid

### burnUSD

  ```solidity
  function burnUSD(uint256 accountId, uint256 fundId, address collateralType, uint256 amount) external
  ```

burns USD for a fund/account from a collateralType

### accountCollateralRatio

  ```solidity
  function accountCollateralRatio(uint256 accountId, uint256 fundId, address collateralType) external returns (uint256)
  ```

gets the CRatio for an account/collateral in a fund

### accountVaultDebt

  ```solidity
  function accountVaultDebt(uint256 accountId, uint256 fundId, address collateralType) external returns (int256)
  ```

gets the account debt in a fund for a collateral

### accountVaultCollateral

  ```solidity
  function accountVaultCollateral(uint256 accountId, uint256 fundId, address collateralType) external view returns (uint256 amount, uint256 value, uint256 shares)
  ```

gets the account collateral value in a fund for a collateral

### vaultDebt

  ```solidity
  function vaultDebt(uint256 fundId, address collateralType) external returns (int256)
  ```

gets the total fund debt

### vaultCollateral

  ```solidity
  function vaultCollateral(uint256 fundId, address collateralType) external returns (uint256 amount, uint256 value)
  ```

gets total vault collateral and its value

### totalVaultShares

  ```solidity
  function totalVaultShares(uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the total fund debtShares

### debtPerShare

  ```solidity
  function debtPerShare(uint256 fundId, address collateralType) external returns (int256)
  ```

gets the debt per share (USD value) for a fund

### getLiquidityItem

  ```solidity
  function getLiquidityItem(bytes32 liquidityItemId) external view returns (struct FundVaultStorage.LiquidityItem liquidityItem)
  ```

gets liquidityItem details for a liquidityItemId

## Vault Rewards Module

### distributeRewards

  ```solidity
  function distributeRewards(uint256 fundId, address token, uint256 index, address distributor, uint256 amount, uint256 start, uint256 duration) external
  ```

called by fund owner or an existing distributor to set up rewards for vault participants

### getAvailableRewards

  ```solidity
  function getAvailableRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards.
this function should be called to get currently available rewards using `callStatic`

### claimRewards

  ```solidity
  function claimRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards, and claims them to the caller's account.
this function should be called to get currently available rewards using `callStatic`

### getCurrentRewardAccumulation

  ```solidity
  function getCurrentRewardAccumulation(uint256 fundId, address collateralType) external view returns (uint256[])
  ```

returns the number of individual units of amount emitted per second per share for the given fundId, collateralType vault

### distributeRewards

  ```solidity
  function distributeRewards(uint256 fundId, address token, uint256 index, address distributor, uint256 amount, uint256 start, uint256 duration) external
  ```

called by fund owner or an existing distributor to set up rewards for vault participants

### getAvailableRewards

  ```solidity
  function getAvailableRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards.
this function should be called to get currently available rewards using `callStatic`

### claimRewards

  ```solidity
  function claimRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of available rewards, and claims them to the caller's account.
this function should be called to get currently available rewards using `callStatic`

### getCurrentRewardAccumulation

  ```solidity
  function getCurrentRewardAccumulation(uint256 fundId, address collateralType) external view returns (uint256[])
  ```

returns the number of individual units of amount emitted per second per share for the given fundId, collateralType vault

