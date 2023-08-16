### Async Order Module

#### commitOrder

  ```solidity
  function commitOrder(struct AsyncOrder.OrderCommitmentRequest commitment) external returns (struct AsyncOrder.Data retOrder, uint256 fees)
  ```

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

  For a given market, account id, and a position size, returns the required total account margin for this order to succeed

  Useful for integrators to determine if an order will succeed or fail

**Parameters**
* `marketId` (*uint128*) - id of the market.
* `accountId` (*uint128*) - id of the trader account.
* `sizeDelta` (*int128*) - size of position.

**Returns**
* `requiredMargin` (*uint256*) - margin required for the order to succeed.

#### OrderCommitted

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

#### PreviousOrderExpired

  ```solidity
  event PreviousOrderExpired(uint128 marketId, uint128 accountId, int128 sizeDelta, uint256 acceptablePrice, uint256 settlementTime, bytes32 trackingCode)
  ```

  Gets fired when a new order is committed while a previous one was expired.

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
* `accountId` (*uint128*) - Id of the account used for the trade.

#### settlePythOrder

  ```solidity
  function settlePythOrder(bytes result, bytes extraData) external payable
  ```

  Settles an offchain order using the offchain retrieved data from pyth.

**Parameters**
* `result` (*bytes*) - the blob of data retrieved offchain.
* `extraData` (*bytes*) - Extra data from OffchainLookupData.

#### OrderSettled

  ```solidity
  event OrderSettled(uint128 marketId, uint128 accountId, uint256 fillPrice, int256 pnl, int256 accruedFunding, int128 sizeDelta, int128 newSize, uint256 totalFees, uint256 referralFees, uint256 collectedFees, uint256 settlementReward, bytes32 trackingCode, address settler)
  ```

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

### Global Perps Market Module

#### setMaxCollateralAmount

  ```solidity
  function setMaxCollateralAmount(uint128 synthMarketId, uint256 collateralAmount) external
  ```

  Sets the max collateral amount for a specific synth market.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - Max collateral amount to set for the synth market id.

#### getMaxCollateralAmount

  ```solidity
  function getMaxCollateralAmount(uint128 synthMarketId) external view returns (uint256)
  ```

  Gets the max collateral amount for a specific synth market.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.

**Returns**
* `[0]` (*uint256*) - maxCollateralAmount max collateral amount of the specified synth market id
#### setSynthDeductionPriority

  ```solidity
  function setSynthDeductionPriority(uint128[] newSynthDeductionPriority) external
  ```

  Sets the synth deduction priority ordered list.

  The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.

**Parameters**
* `newSynthDeductionPriority` (*uint128[]*) - Ordered array of synth market ids for deduction priority.

#### getSynthDeductionPriority

  ```solidity
  function getSynthDeductionPriority() external view returns (uint128[])
  ```

  Gets the synth deduction priority ordered list.

  The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.

**Returns**
* `[0]` (*uint128[]*) - synthDeductionPriority Ordered array of synth market ids for deduction priority.
#### setLiquidationRewardGuards

  ```solidity
  function setLiquidationRewardGuards(uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd) external
  ```

  Sets the liquidation reward guard (min and max).

**Parameters**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.

#### getLiquidationRewardGuards

  ```solidity
  function getLiquidationRewardGuards() external view returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
  ```

  Gets the liquidation reward guard (min and max).

**Returns**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.
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
#### setPerAccountCaps

  ```solidity
  function setPerAccountCaps(uint128 maxPositionsPerAccount, uint128 maxCollateralsPerAccount) external
  ```

  Set or update the max number of Positions and Collaterals per Account

**Parameters**
* `maxPositionsPerAccount` (*uint128*) - The max number of concurrent Positions per Account
* `maxCollateralsPerAccount` (*uint128*) - The max number of concurrent Collaterals per Account

#### getPerAccountCaps

  ```solidity
  function getPerAccountCaps() external returns (uint128 maxPositionsPerAccount, uint128 maxCollateralsPerAccount)
  ```

  get the max number of Positions and Collaterals per Account

**Parameters**

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

  ```solidity
  event MaxCollateralAmountSet(uint128 synthMarketId, uint256 collateralAmount)
  ```

  Gets fired when max collateral amount for synth for all the markets is set by owner.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that was set for the synth

#### SynthDeductionPrioritySet

  ```solidity
  event SynthDeductionPrioritySet(uint128[] newSynthDeductionPriority)
  ```

  Gets fired when the synth deduction priority is updated by owner.

**Parameters**
* `newSynthDeductionPriority` (*uint128[]*) - new synth id priority order for deductions.

#### LiquidationRewardGuardsSet

  ```solidity
  event LiquidationRewardGuardsSet(uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
  ```

  Gets fired when liquidation reward guard is set or updated.

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

#### PerAccountCapsSet

  ```solidity
  event PerAccountCapsSet(uint128 maxPositionsPerAccount, uint128 maxCollateralsPerAccount)
  ```

  Gets fired when the max number of Positions and Collaterals per Account are set by owner.

**Parameters**
* `maxPositionsPerAccount` (*uint128*) - The max number of concurrent Positions per Account
* `maxCollateralsPerAccount` (*uint128*) - The max number of concurrent Collaterals per Account

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

### Collateral Module

#### setMaxCollateralAmount

  ```solidity
  function setMaxCollateralAmount(uint128 synthMarketId, uint256 collateralAmount) external
  ```

  Set the max collateral amoutn via this function

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that for the synth

#### MaxCollateralSet

  ```solidity
  event MaxCollateralSet(uint128 synthMarketId, uint256 collateralAmount)
  ```

  Gets fired when max collateral amount for synth collateral for the system is set by owner.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that was set for the synth

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
#### setOrderFees

  ```solidity
  function setOrderFees(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio) external
  ```

  Set order fees for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set order fees.
* `makerFeeRatio` (*uint256*) - the maker fee ratio.
* `takerFeeRatio` (*uint256*) - the taker fee ratio.

#### updatePriceData

  ```solidity
  function updatePriceData(uint128 perpsMarketId, bytes32 feedId) external
  ```

  Set node id for perps market

**Parameters**
* `perpsMarketId` (*uint128*) - id of the market to set price feed.
* `feedId` (*bytes32*) - the node feed id

#### setFundingParameters

  ```solidity
  function setFundingParameters(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity) external
  ```

  Set funding parameters for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set funding parameters.
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.

#### setLiquidationParameters

  ```solidity
  function setLiquidationParameters(uint128 marketId, uint256 initialMarginRatioD18, uint256 minimumInitialMarginRatioD18, uint256 maintenanceMarginScalarD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow, uint256 minimumPositionMargin) external
  ```

  Set liquidation parameters for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set liquidation parameters.
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
* `minimumInitialMarginRatioD18` (*uint256*) - the minimum initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginScalarD18` (*uint256*) - the maintenance margin scalar relative to the initial margin ratio (as decimal with 18 digits precision).
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
* `minimumPositionMargin` (*uint256*) - the minimum position margin.

#### setMaxMarketSize

  ```solidity
  function setMaxMarketSize(uint128 marketId, uint256 maxMarketSize) external
  ```

  Set the max size of an specific market with this function.

  This controls the maximum open interest a market can have on either side (Long | Short). So the total Open Interest (with zero skew) for a market can be up to max market size * 2.

**Parameters**
* `marketId` (*uint128*) - id of the market to set the max market value.
* `maxMarketSize` (*uint256*) - the max market size in market asset units.

#### setLockedOiRatio

  ```solidity
  function setLockedOiRatio(uint128 marketId, uint256 lockedOiRatioD18) external
  ```

  Set the locked OI Ratio for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set locked OI ratio.
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

#### setSettlementStrategyEnabled

  ```solidity
  function setSettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled) external
  ```

  Enable or disable a settlement strategy for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market.
* `strategyId` (*uint256*) - the specific strategy.
* `enabled` (*bool*) - whether the strategy is enabled or disabled.

#### getSettlementStrategy

  ```solidity
  function getSettlementStrategy(uint128 marketId, uint256 strategyId) external view returns (struct SettlementStrategy.Data settlementStrategy)
  ```

  Gets the settlement strategy details.

**Parameters**
* `marketId` (*uint128*) - id of the market.
* `strategyId` (*uint256*) - id of the settlement strategy.

**Returns**
* `settlementStrategy` (*struct SettlementStrategy.Data*) - strategy details (see SettlementStrategy.Data struct).
#### getLiquidationParameters

  ```solidity
  function getLiquidationParameters(uint128 marketId) external view returns (uint256 initialMarginRatioD18, uint256 minimumInitialMarginRatioD18, uint256 maintenanceMarginScalarD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow, uint256 minimumPositionMargin)
  ```

  Gets liquidation parameters details of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
* `minimumInitialMarginRatioD18` (*uint256*) - the minimum initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginScalarD18` (*uint256*) - the maintenance margin scalar relative to the initial margin ratio (as decimal with 18 digits precision).
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
* `minimumPositionMargin` (*uint256*) - the minimum position margin.
#### getFundingParameters

  ```solidity
  function getFundingParameters(uint128 marketId) external view returns (uint256 skewScale, uint256 maxFundingVelocity)
  ```

  Gets funding parameters of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.
#### getMaxMarketSize

  ```solidity
  function getMaxMarketSize(uint128 marketId) external view returns (uint256 maxMarketSize)
  ```

  Gets the max size of an specific market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `maxMarketSize` (*uint256*) - the max market size in market asset units.
#### getOrderFees

  ```solidity
  function getOrderFees(uint128 marketId) external view returns (uint256 makerFeeRatio, uint256 takerFeeRatio)
  ```

  Gets the order fees of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `makerFeeRatio` (*uint256*) - the maker fee ratio.
* `takerFeeRatio` (*uint256*) - the taker fee ratio.
#### getLockedOiRatio

  ```solidity
  function getLockedOiRatio(uint128 marketId) external view returns (uint256 lockedOiRatioD18)
  ```

  Gets the locked OI ratio of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

#### SettlementStrategyAdded

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

#### FundingParametersSet

  ```solidity
  event FundingParametersSet(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity)
  ```

  Gets fired when funding parameters are updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.

#### LiquidationParametersSet

  ```solidity
  event LiquidationParametersSet(uint128 marketId, uint256 initialMarginRatioD18, uint256 maintenanceMarginRatioD18, uint256 minimumInitialMarginRatioD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow, uint256 minimumPositionMargin)
  ```

  Gets fired when liquidation parameters are updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginRatioD18` (*uint256*) - the maintenance margin ratio (as decimal with 18 digits precision).
* `minimumInitialMarginRatioD18` (*uint256*) - 
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
* `minimumPositionMargin` (*uint256*) - the minimum position margin.

#### MaxMarketSizeSet

  ```solidity
  event MaxMarketSizeSet(uint128 marketId, uint256 maxMarketSize)
  ```

  Gets fired when max market value is updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `maxMarketSize` (*uint256*) - the max market value.

#### LockedOiRatioSet

  ```solidity
  event LockedOiRatioSet(uint128 marketId, uint256 lockedOiRatioD18)
  ```

  Gets fired when locked oi ratio is updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

#### SettlementStrategyEnabled

  ```solidity
  event SettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled)
  ```

  Gets fired when a settlement strategy is enabled or disabled.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `strategyId` (*uint256*) - the specific strategy.
* `enabled` (*bool*) - whether the strategy is enabled or disabled.

