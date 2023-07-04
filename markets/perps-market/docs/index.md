# Solidity API

## Account Module

### modifyCollateral

  ```solidity
  function modifyCollateral(uint128 accountId, uint128 synthMarketId, int256 amountDelta) external
  ```

  Modify the collateral delegated to the account.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `synthMarketId` (*uint128*) - Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
* `amountDelta` (*int256*) - requested change in amount of collateral delegated to the account.

### getCollateralAmount

  ```solidity
  function getCollateralAmount(uint128 accountId, uint128 synthMarketId) external view returns (uint256)
  ```

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

  ```solidity
  event CollateralModified(uint128 accountId, uint128 synthMarketId, int256 amountDelta, address sender)
  ```

  Gets fired when an account colateral is modified.

**Parameters**
* `accountId` (*uint128*) - Id of the account.
* `synthMarketId` (*uint128*) - Id of the synth market used as collateral. Synth market id, 0 for snxUSD.
* `amountDelta` (*int256*) - requested change in amount of collateral delegated to the account.
* `sender` (*address*) - address of the sender of the size modification. Authorized by account owner.

## Async Order Module

### commitOrder

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

### OrderCanceled

  ```solidity
  event OrderCanceled(uint128 marketId, uint128 accountId, uint256 settlementTime, uint256 acceptablePrice)
  ```

  Gets fired when a new order is canceled.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.
* `settlementTime` (*uint256*) - Time at which the order can be settled.
* `acceptablePrice` (*uint256*) - maximum or minimum, depending on the sizeDelta direction, accepted price to settle the order, set by the user.

## Async Order Settlement Module

### settle

  ```solidity
  function settle(uint128 marketId, uint128 accountId) external view
  ```

  Settles an offchain order. It's expected to revert with the OffchainLookup error with the data needed to perform the offchain lookup.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `accountId` (*uint128*) - Id of the account used for the trade.

### settlePythOrder

  ```solidity
  function settlePythOrder(bytes result, bytes extraData) external payable
  ```

  Settles an offchain order using the offchain retrieved data from pyth.

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

### setMaxCollateralAmount

  ```solidity
  function setMaxCollateralAmount(uint128 synthMarketId, uint256 collateralAmount) external
  ```

  Set the max collateral amoutn via this function

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that for the synth

### MaxCollateralSet

  ```solidity
  event MaxCollateralSet(uint128 synthMarketId, uint256 collateralAmount)
  ```

  Gets fired when max collateral amount for synth collateral for the system is set by owner.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that was set for the synth

## Global Perps Market Module

### setMaxCollateralAmount

  ```solidity
  function setMaxCollateralAmount(uint128 synthMarketId, uint256 collateralAmount) external
  ```

  Sets the max collateral amount for a specific synth market.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - Max collateral amount to set for the synth market id.

### getMaxCollateralAmount

  ```solidity
  function getMaxCollateralAmount(uint128 synthMarketId) external view returns (uint256)
  ```

  Gets the max collateral amount for a specific synth market.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.

**Returns**
* `[0]` (*uint256*) - maxCollateralAmount max collateral amount of the specified synth market id
### setSynthDeductionPriority

  ```solidity
  function setSynthDeductionPriority(uint128[] newSynthDeductionPriority) external
  ```

  Sets the synth deduction priority ordered list.

  The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.

**Parameters**
* `newSynthDeductionPriority` (*uint128[]*) - Ordered array of synth market ids for deduction priority.

### getSynthDeductionPriority

  ```solidity
  function getSynthDeductionPriority() external view returns (uint128[])
  ```

  Gets the synth deduction priority ordered list.

  The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.

**Returns**
* `[0]` (*uint128[]*) - synthDeductionPriority Ordered array of synth market ids for deduction priority.
### setLiquidationRewardGuards

  ```solidity
  function setLiquidationRewardGuards(uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd) external
  ```

  Sets the liquidation reward guard (min and max).

**Parameters**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.

### getLiquidationRewardGuards

  ```solidity
  function getLiquidationRewardGuards() external view returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
  ```

  Gets the liquidation reward guard (min and max).

**Returns**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.

### MaxCollateralAmountSet

  ```solidity
  event MaxCollateralAmountSet(uint128 synthMarketId, uint256 collateralAmount)
  ```

  Gets fired when max collateral amount for synth for all the markets is set by owner.

**Parameters**
* `synthMarketId` (*uint128*) - Synth market id, 0 for snxUSD.
* `collateralAmount` (*uint256*) - max amount that was set for the synth

### SynthDeductionPrioritySet

  ```solidity
  event SynthDeductionPrioritySet(uint128[] newSynthDeductionPriority)
  ```

  Gets fired when the synth deduction priority is updated by owner.

**Parameters**
* `newSynthDeductionPriority` (*uint128[]*) - new synth id priority order for deductions.

### LiquidationRewardGuardsSet

  ```solidity
  event LiquidationRewardGuardsSet(uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
  ```

  Gets fired when liquidation reward guard is set or updated.

**Parameters**
* `minLiquidationRewardUsd` (*uint256*) - Minimum liquidation reward expressed as USD value.
* `maxLiquidationRewardUsd` (*uint256*) - Maximum liquidation reward expressed as USD value.

## Liquidation Module

### liquidate

  ```solidity
  function liquidate(uint128 accountId) external
  ```

### liquidateFlagged

  ```solidity
  function liquidateFlagged() external
  ```

## Market Configuration Module

### addSettlementStrategy

  ```solidity
  function addSettlementStrategy(uint128 marketId, struct SettlementStrategy.Data strategy) external returns (uint256 strategyId)
  ```

  Add a new settlement strategy with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to add the settlement strategy.
* `strategy` (*struct SettlementStrategy.Data*) - strategy details (see SettlementStrategy.Data struct).

**Returns**
* `strategyId` (*uint256*) - id of the new settlement strategy.
### setOrderFees

  ```solidity
  function setOrderFees(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio) external
  ```

  Set order fees for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set order fees.
* `makerFeeRatio` (*uint256*) - the maker fee ratio.
* `takerFeeRatio` (*uint256*) - the taker fee ratio.

### setFundingParameters

  ```solidity
  function setFundingParameters(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity) external
  ```

  Set funding parameters for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set funding parameters.
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.

### setLiquidationParameters

  ```solidity
  function setLiquidationParameters(uint128 marketId, uint256 initialMarginRatioD18, uint256 maintenanceMarginRatioD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow, uint256 minimumPositionMargin) external
  ```

  Set liquidation parameters for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set liquidation parameters.
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginRatioD18` (*uint256*) - the maintenance margin ratio (as decimal with 18 digits precision).
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
* `minimumPositionMargin` (*uint256*) - the minimum position margin.

### setMaxMarketSize

  ```solidity
  function setMaxMarketSize(uint128 marketId, uint256 maxMarketSize) external
  ```

  Set the max size of an specific market with this function.

  This controls the maximum open interest a market can have on either side (Long | Short). So the total Open Interest (with zero skew) for a market can be up to max market size * 2.

**Parameters**
* `marketId` (*uint128*) - id of the market to set the max market value.
* `maxMarketSize` (*uint256*) - the max market size in market asset units.

### setLockedOiRatio

  ```solidity
  function setLockedOiRatio(uint128 marketId, uint256 lockedOiRatioD18) external
  ```

  Set the locked OI Ratio for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market to set locked OI ratio.
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

### setSettlementStrategyEnabled

  ```solidity
  function setSettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled) external
  ```

  Enable or disable a settlement strategy for a market with this function.

**Parameters**
* `marketId` (*uint128*) - id of the market.
* `strategyId` (*uint256*) - the specific strategy.
* `enabled` (*bool*) - whether the strategy is enabled or disabled.

### getSettlementStrategy

  ```solidity
  function getSettlementStrategy(uint128 marketId, uint256 strategyId) external view returns (struct SettlementStrategy.Data settlementStrategy)
  ```

  Gets the settlement strategy details.

**Parameters**
* `marketId` (*uint128*) - id of the market.
* `strategyId` (*uint256*) - id of the settlement strategy.

**Returns**
* `settlementStrategy` (*struct SettlementStrategy.Data*) - strategy details (see SettlementStrategy.Data struct).
### getLiquidationParameters

  ```solidity
  function getLiquidationParameters(uint128 marketId) external view returns (uint256 initialMarginRatioD18, uint256 maintenanceMarginRatioD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow)
  ```

  Gets liquidation parameters details of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginRatioD18` (*uint256*) - the maintenance margin ratio (as decimal with 18 digits precision).
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
### getFundingParameters

  ```solidity
  function getFundingParameters(uint128 marketId) external view returns (uint256 skewScale, uint256 maxFundingVelocity)
  ```

  Gets funding parameters of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.
### getMaxMarketSize

  ```solidity
  function getMaxMarketSize(uint128 marketId) external view returns (uint256 maxMarketSize)
  ```

  Gets the max size of an specific market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `maxMarketSize` (*uint256*) - the max market size in market asset units.
### getOrderFees

  ```solidity
  function getOrderFees(uint128 marketId) external view returns (uint256 makerFeeRatio, uint256 takerFeeRatio)
  ```

  Gets the order fees of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `makerFeeRatio` (*uint256*) - the maker fee ratio.
* `takerFeeRatio` (*uint256*) - the taker fee ratio.
### getLockedOiRatioD18

  ```solidity
  function getLockedOiRatioD18(uint128 marketId) external view returns (uint256 lockedOiRatioD18)
  ```

  Gets the locked OI ratio of a market.

**Parameters**
* `marketId` (*uint128*) - id of the market.

**Returns**
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

### SettlementStrategyAdded

  ```solidity
  event SettlementStrategyAdded(uint128 marketId, struct SettlementStrategy.Data strategy, uint256 strategyId)
  ```

  Gets fired when new settlement strategy is added.

**Parameters**
* `marketId` (*uint128*) - adds settlement strategy to this specific market.
* `strategy` (*struct SettlementStrategy.Data*) - the strategy configuration.
* `strategyId` (*uint256*) - the newly created settlement strategy id.

### OrderFeesSet

  ```solidity
  event OrderFeesSet(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio)
  ```

  Gets fired when order fees are updated.

**Parameters**
* `marketId` (*uint128*) - udpates fees to this specific market.
* `makerFeeRatio` (*uint256*) - the maker fee ratio.
* `takerFeeRatio` (*uint256*) - the taker fee ratio.

### FundingParametersSet

  ```solidity
  event FundingParametersSet(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity)
  ```

  Gets fired when funding parameters are updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `skewScale` (*uint256*) - the skew scale.
* `maxFundingVelocity` (*uint256*) - the max funding velocity.

### LiquidationParametersSet

  ```solidity
  event LiquidationParametersSet(uint128 marketId, uint256 initialMarginRatioD18, uint256 maintenanceMarginRatioD18, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier, uint256 maxSecondsInLiquidationWindow, uint256 minimumPositionMargin)
  ```

  Gets fired when liquidation parameters are updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `initialMarginRatioD18` (*uint256*) - the initial margin ratio (as decimal with 18 digits precision).
* `maintenanceMarginRatioD18` (*uint256*) - the maintenance margin ratio (as decimal with 18 digits precision).
* `liquidationRewardRatioD18` (*uint256*) - the liquidation reward ratio (as decimal with 18 digits precision).
* `maxLiquidationLimitAccumulationMultiplier` (*uint256*) - the max liquidation limit accumulation multiplier.
* `maxSecondsInLiquidationWindow` (*uint256*) - the max seconds in liquidation window (used together with the acc multiplier to get max liquidation per window).
* `minimumPositionMargin` (*uint256*) - the minimum position margin.

### MaxMarketSizeSet

  ```solidity
  event MaxMarketSizeSet(uint128 marketId, uint256 maxMarketSize)
  ```

  Gets fired when max market value is updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `maxMarketSize` (*uint256*) - the max market value.

### LockedOiRatioD18Set

  ```solidity
  event LockedOiRatioD18Set(uint128 marketId, uint256 lockedOiRatioD18)
  ```

  Gets fired when locked oi ratio is updated.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `lockedOiRatioD18` (*uint256*) - the locked OI ratio skew scale (as decimal with 18 digits precision).

### SettlementStrategyEnabled

  ```solidity
  event SettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled)
  ```

  Gets fired when a settlement strategy is enabled or disabled.

**Parameters**
* `marketId` (*uint128*) - udpates funding parameters to this specific market.
* `strategyId` (*uint256*) - the specific strategy.
* `enabled` (*bool*) - whether the strategy is enabled or disabled.

## IMarketEvents

### MarketUpdated

  ```solidity
  event MarketUpdated(uint128 marketId, int256 skew, uint256 size, int256 sizeDelta, int256 currentFundingRate, int256 currentFundingVelocity)
  ```

## Perps Market Factory Module

### setSynthetix

  ```solidity
  function setSynthetix(contract ISynthetixSystem synthetix) external
  ```

### setSpotMarket

  ```solidity
  function setSpotMarket(contract ISpotMarketSystem spotMarket) external
  ```

### createMarket

  ```solidity
  function createMarket(string marketName, string marketSymbol, address marketOwner) external returns (uint128)
  ```

### symbol

  ```solidity
  function symbol(uint128 marketId) external view returns (string)
  ```

### updatePriceData

  ```solidity
  function updatePriceData(uint128 perpsMarketId, bytes32 feedId) external
  ```

### nominateMarketOwner

  ```solidity
  function nominateMarketOwner(uint128 perpsMarketId, address newNominatedOwner) external
  ```

### acceptMarketOwnership

  ```solidity
  function acceptMarketOwnership(uint128 perpsMarketId) external
  ```

### getMarketOwner

  ```solidity
  function getMarketOwner(uint128 perpsMarketId) external view returns (address)
  ```

### name

  ```solidity
  function name(uint128 marketId) external view returns (string)
  ```

  returns a human-readable name for a given market

### reportedDebt

  ```solidity
  function reportedDebt(uint128 marketId) external view returns (uint256)
  ```

  returns amount of USD that the market would try to mint256 if everything was withdrawn

### minimumCredit

  ```solidity
  function minimumCredit(uint128 marketId) external view returns (uint256)
  ```

  prevents reduction of available credit capacity by specifying this amount, for which withdrawals will be disallowed

### supportsInterface

  ```solidity
  function supportsInterface(bytes4 interfaceID) external view returns (bool)
  ```

  Determines if the contract in question supports the specified interface.

**Parameters**
* `interfaceID` (*bytes4*) - XOR of all selectors in the contract.

**Returns**
* `[0]` (*bool*) - True if the contract supports the specified interface.

### MarketRegistered

  ```solidity
  event MarketRegistered(uint128 perpsMarketId, address marketOwner, string marketName, string marketSymbol)
  ```

### MarketOwnerNominated

  ```solidity
  event MarketOwnerNominated(uint128 perpsMarketId, address newNominatedOwner)
  ```

### MarketOwnerChanged

  ```solidity
  event MarketOwnerChanged(uint128 perpsMarketId, address oldOwner, address newOwner)
  ```

### MarketPriceDataUpdated

  ```solidity
  event MarketPriceDataUpdated(uint128 perpsMarketId, bytes32 feedId)
  ```

## Perps Market Module

### skew

  ```solidity
  function skew(uint128 marketId) external view returns (int256)
  ```

### size

  ```solidity
  function size(uint128 marketId) external view returns (uint256)
  ```

### maxOpenInterest

  ```solidity
  function maxOpenInterest(uint128 marketId) external view returns (uint256)
  ```

### currentFundingRate

  ```solidity
  function currentFundingRate(uint128 marketId) external view returns (int256)
  ```

### currentFundingVelocity

  ```solidity
  function currentFundingVelocity(uint128 marketId) external view returns (int256)
  ```

### indexPrice

  ```solidity
  function indexPrice(uint128 marketId) external view returns (uint256)
  ```

### fillPrice

  ```solidity
  function fillPrice(uint128 marketId, int256 orderSize, uint256 price) external returns (uint256)
  ```

### getMarketSummary

  ```solidity
  function getMarketSummary(uint128 marketId) external view returns (struct IPerpsMarketModule.MarketSummary summary)
  ```

  Given a marketId return a market's summary details in one call.

