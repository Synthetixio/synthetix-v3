# Solidity API

## Account Module

### getAccountAddress

  ```solidity
  function getAccountAddress() external view returns (contract INftModule)
  ```

gets the AccountToken address.

### createAccount

  ```solidity
  function createAccount(uint256 accountId) external
  ```

creates a new accountToken (NFT)

### transferAccount

  ```solidity
  function transferAccount(address to, uint256 accountId) external
  ```

creates a new accountToken (NFT)

### grantRole

  ```solidity
  function grantRole(uint256 accountId, bytes32 role, address target) external
  ```

grants "target" address the "role" role for the "accountId" account token NFT

### revokeRole

  ```solidity
  function revokeRole(uint256 accountId, bytes32 role, address target) external
  ```

revokes "target" address the "role" role for the "accountId" account token NFT

### renounceRole

  ```solidity
  function renounceRole(uint256 accountId, bytes32 role, address target) external
  ```

the sender (must be the same as "target") renounces to the "role" role for the "accountId" account token NFT

### hasRole

  ```solidity
  function hasRole(uint256 accountId, bytes32 role, address target) external view returns (bool)
  ```

checks if the "target" address has the "role" role granted for the "accountId" account token NFT

## Account Token Module

### mint

  ```solidity
  function mint(address owner, uint256 requestedAccountId) external
  ```

mints a new token (NFT) with the "requestedAccountId" id owned by "owner". It can ol=nly be called by the system

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
  function setApprovalForAll(address operator, bool _approved) external
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

## Fund Module

### createFund

  ```solidity
  function createFund(uint256 requestedFundId, address owner) external
  ```

creates a new fundToken (NFT)

### setFundPosition

  ```solidity
  function setFundPosition(uint256 fundId, uint256[] markets, uint256[] weights, uint256[] maxDebtShareValues) external
  ```

sets the fund positions (only fundToken owner)

### getFundPosition

  ```solidity
  function getFundPosition(uint256 fundId) external view returns (uint256[] markets, uint256[] weights, uint256[] maxDebtShareValues)
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
  function liquidate(uint256 accountId, uint256 fundId, address collateralType) external
  ```

liquidates the required collateral of the account delegated to the fundId

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

### liquidity

  ```solidity
  function liquidity(uint256 marketId) external view returns (uint256)
  ```

gets the liquidity of the market

### totalBalance

  ```solidity
  function totalBalance(uint256 marketId) external view returns (int256)
  ```

gets the total balance of the market

### fundBalance

  ```solidity
  function fundBalance(uint256 marketId, uint256 fundId) external view returns (int256)
  ```

gets the total balance of a fund

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

### getUSDTokenModuleSatellites

  ```solidity
  function getUSDTokenModuleSatellites() external view returns (struct ISatelliteFactory.Satellite[])
  ```

gets the USDToken Satellites created (only one, at idx 0).

## Vault Module

### delegateCollateral

  ```solidity
  function delegateCollateral(uint256 accountId, uint256 fundId, address collateralType, uint256 amount, uint256 leverage) external
  ```

delegates (creates, adjust or remove a delegation) collateral from an account

### distributeRewards

  ```solidity
  function distributeRewards(uint256 fundId, address token, uint256 index, address distributor, uint256 amount, uint256 start, uint256 duration) external
  ```

called by fund owner or an existing distributor to set up rewards for vault participants

### claimRewards

  ```solidity
  function claimRewards(uint256 fundId, address token, uint256 accountId) external
  ```

retrieves all available rewards for delegation to a vault to the caller's account

### getAvailableRewards

  ```solidity
  function getAvailableRewards(uint256 fundId, address token, uint256 accountId) external returns (uint256[])
  ```

retrieves the amount of rewards . This call is mutable becuase it internally calls `updateRewards` to determine
the most up-to-date amounts, but normally this should be executed with `callStatic`

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

### collateralizationRatio

  ```solidity
  function collateralizationRatio(uint256 accountId, uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the CRatio for an account/collateral in a fund

### accountFundDebt

  ```solidity
  function accountFundDebt(uint256 accountId, uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the account debt in a fund for a collateral

### accountFundCollateralValue

  ```solidity
  function accountFundCollateralValue(uint256 accountId, uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the account collateral value in a fund for a collateral

### fundDebt

  ```solidity
  function fundDebt(uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the total fund debt

### totalDebtShares

  ```solidity
  function totalDebtShares(uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the total fund debtShares

### debtPerShare

  ```solidity
  function debtPerShare(uint256 fundId, address collateralType) external view returns (uint256)
  ```

gets the debt per share (USD value) for a fund

### getLiquidityItem

  ```solidity
  function getLiquidityItem(bytes32 liquidityItemId) external view returns (struct IVaultModuleStorage.LiquidityItem liquidityItem)
  ```

gets liquidityItem details for a liquidityItemId

### getAccountLiquidityItemIds

  ```solidity
  function getAccountLiquidityItemIds(uint256 accountId) external view returns (bytes32[] liquidityItemIds)
  ```

gets list of liquidityItemIds for an accountId

### getAccountLiquidityItems

  ```solidity
  function getAccountLiquidityItems(uint256 accountId) external view returns (struct IVaultModuleStorage.LiquidityItem[] liquidityItems)
  ```

gets list of liquidityItem details for an accountId

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

