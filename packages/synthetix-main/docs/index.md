# Solidity API

## Account Module

### AccountPermission

```solidity
struct AccountPermission {
  address target;
  bytes32[] roles;
}

```

### getAccountAddress

```solidity
function getAccountAddress() external view returns (contract INftModule)
```

gets the AccountToken address.

### getAccountPermissions

```solidity
function getAccountPermissions(uint256 accountId) external view returns (struct IAccountModule.AccountPermission[])
```

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

### AccountPermission

```solidity
struct AccountPermission {
  address target;
  bytes32[] roles;
}

```

### getAccountAddress

```solidity
function getAccountAddress() external view returns (contract INftModule)
```

gets the AccountToken address.

### getAccountPermissions

```solidity
function getAccountPermissions(uint256 accountId) external view returns (struct IAccountModule.AccountPermission[])
```

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

### Satellite

```solidity
struct Satellite {
  bytes32 name;
  bytes32 contractName;
  address deployedAddress;
}

```

## Account Token Module

### isInitialized

```solidity
function isInitialized() external returns (bool)
```

returns if `initialize` has been called by the owner

### initialize

```solidity
function initialize(string tokenName, string tokenSymbol, string uri) external
```

allows owner to initialize the token after attaching a proxy

### mint

```solidity
function mint(address owner, uint256 requestedAccountId) external
```

mints a new token (NFT) with the "requestedAccountId" id owned by "owner". It can ol=nly be called by the system

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
function balanceOf(address owner) external view returns (uint256)
```

### ownerOf

```solidity
function ownerOf(uint256 tokenId) external view returns (address)
```

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external
```

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId) external
```

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 tokenId) external
```

### approve

```solidity
function approve(address approved, uint256 tokenId) external
```

### setApprovalForAll

```solidity
function setApprovalForAll(address operator, bool approved) external
```

### getApproved

```solidity
function getApproved(uint256 tokenId) external view returns (address)
```

### isApprovedForAll

```solidity
function isApprovedForAll(address owner, address operator) external view returns (bool)
```

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceID) external view returns (bool)
```

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
