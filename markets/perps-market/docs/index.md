# Solidity API

## Account Module

### modifyCollateral

  ```solidity
  function modifyCollateral(uint128 accountId, uint128 synthMarketId, int256 amountDelta) external
  ```

### totalCollateralValue

  ```solidity
  function totalCollateralValue(uint128 accountId) external view returns (uint256)
  ```

### totalAccountOpenInterest

  ```solidity
  function totalAccountOpenInterest(uint128 accountId) external view returns (uint256)
  ```

### getOpenPosition

  ```solidity
  function getOpenPosition(uint128 accountId, uint128 marketId) external view returns (int256, int256, int256)
  ```

### getAsyncOrderClaim

  ```solidity
  function getAsyncOrderClaim(uint128 accountId, uint128 marketId) external view returns (struct AsyncOrder.Data)
  ```

  Get async order claim details

**Parameters**
* `accountId` (*uint128*) - id of the account.
* `marketId` (*uint128*) - Id of the market used for the trade.

**Returns**
* `[0]` (*struct AsyncOrder.Data*) - asyncOrderClaim claim details (see AsyncOrder.Data struct).
### getAvailableMargin

  ```solidity
  function getAvailableMargin(uint128 accountId) external view returns (int256)
  ```

### CollateralModified

  ```solidity
  event CollateralModified(uint128 accountId, uint128 synthMarketId, int256 amountDelta, address sender)
  ```

## Async Order Module

### commitOrder

  ```solidity
  function commitOrder(struct AsyncOrder.OrderCommitmentRequest commitment) external returns (struct AsyncOrder.Data retOrder, uint256 fees)
  ```

### OrderCommitted

  ```solidity
  event OrderCommitted(uint128 marketId, uint128 accountId, enum SettlementStrategy.Type orderType, int256 sizeDelta, uint256 acceptablePrice, uint256 settlementTime, uint256 expirationTime, bytes32 trackingCode, address sender)
  ```

### OrderSettled

  ```solidity
  event OrderSettled(uint128 marketId, uint128 accountId, uint256 fillPrice, int256 accountPnlRealized, int128 newSize, uint256 collectedFees, uint256 settelementReward, bytes32 trackingCode, address settler)
  ```

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

### setOrderFees

  ```solidity
  function setOrderFees(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio) external
  ```

### setFundingParameters

  ```solidity
  function setFundingParameters(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity) external
  ```

### setLiquidationParameters

  ```solidity
  function setLiquidationParameters(uint128 marketId, uint256 initialMarginFraction, uint256 maintenanceMarginFraction, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier) external
  ```

### setMaxMarketValue

  ```solidity
  function setMaxMarketValue(uint128 marketId, uint256 maxMarketValue) external
  ```

### setLockedOiPercent

  ```solidity
  function setLockedOiPercent(uint128 marketId, uint256 lockedOiPercent) external
  ```

### setSettlementStrategyEnabled

  ```solidity
  function setSettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled) external
  ```

### getSettlementStrategy

  ```solidity
  function getSettlementStrategy(uint128 marketId, uint256 strategyId) external view returns (struct SettlementStrategy.Data settlementStrategy)
  ```

### getLiquidationParameters

  ```solidity
  function getLiquidationParameters(uint128 marketId) external view returns (uint256 initialMarginFraction, uint256 maintenanceMarginFraction, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier)
  ```

### getFundingParameters

  ```solidity
  function getFundingParameters(uint128 marketId) external view returns (uint256 skewScale, uint256 maxFundingVelocity)
  ```

### getMaxMarketValue

  ```solidity
  function getMaxMarketValue(uint128 marketId) external view returns (uint256 maxMarketValue)
  ```

### getOrderFees

  ```solidity
  function getOrderFees(uint128 marketId) external view returns (uint256 makerFee, uint256 takerFee)
  ```

### getLockedOiPercent

  ```solidity
  function getLockedOiPercent(uint128 marketId) external view returns (uint256 lockedOiPercent)
  ```

### SettlementStrategyAdded

  ```solidity
  event SettlementStrategyAdded(uint128 marketId, struct SettlementStrategy.Data strategy)
  ```

### OrderFeesSet

  ```solidity
  event OrderFeesSet(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio)
  ```

### FundingParametersSet

  ```solidity
  event FundingParametersSet(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity)
  ```

### LiquidationParametersSet

  ```solidity
  event LiquidationParametersSet(uint128 marketId, uint256 initialMarginFraction, uint256 maintenanceMarginFraction, uint256 liquidationRewardRatioD18, uint256 maxLiquidationLimitAccumulationMultiplier)
  ```

### MaxMarketValueSet

  ```solidity
  event MaxMarketValueSet(uint128 marketId, uint256 maxMarketValue)
  ```

### LockedOiPercentSet

  ```solidity
  event LockedOiPercentSet(uint128 marketId, uint256 lockedOiPercent)
  ```

### SettlementStrategyEnabled

  ```solidity
  event SettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled)
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

## Collateral Module

### setMaxCollateralAmount

  ```solidity
  function setMaxCollateralAmount(uint128 synthId, uint256 maxCollateralAmount) external
  ```

### MaxCollateralSet

  ```solidity
  event MaxCollateralSet(uint128 synthId, uint256 maxCollateralAmount)
  ```

  Gets fired when max collateral amount for synth is set by owner.

**Parameters**
* `synthId` (*uint128*) - Synth market id, 0 for snxUSD.
* `maxCollateralAmount` (*uint256*) - max amount that was set for the synth

## Global Perps Market Module

### getMaxCollateralAmountsForSynthMarket

  ```solidity
  function getMaxCollateralAmountsForSynthMarket(uint128 synthMarketId) external view returns (uint256)
  ```

### setMaxCollateralForSynthMarketId

  ```solidity
  function setMaxCollateralForSynthMarketId(uint128 synthMarketId, uint256 collateralAmount) external
  ```

### setSynthDeductionPriority

  ```solidity
  function setSynthDeductionPriority(uint128[] newSynthDeductionPriority) external
  ```

### getSynthDeductionPriority

  ```solidity
  function getSynthDeductionPriority() external view returns (uint128[])
  ```

### setLiquidationRewardGuards

  ```solidity
  function setLiquidationRewardGuards(uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd) external
  ```

### getLiquidationRewardGuards

  ```solidity
  function getLiquidationRewardGuards() external view returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
  ```

## Limit Order Module

