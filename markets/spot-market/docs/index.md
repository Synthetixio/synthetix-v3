# Solidity API

## Async Order Configuration Module

### addSettlementStrategy

  ```solidity
  function addSettlementStrategy(uint128 synthMarketId, struct SettlementStrategy.Data strategy) external returns (uint256 strategyId)
  ```

  Adds new settlement strategy to the specified market id.

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market to associate the strategy with.
* `strategy` (*struct SettlementStrategy.Data*) - Settlement strategy data. see SettlementStrategy.Data struct.

**Returns**
* `strategyId` (*uint256*) - newly created settlement strategy id.
### setSettlementStrategyEnabled

  ```solidity
  function setSettlementStrategyEnabled(uint128 synthMarketId, uint256 strategyId, bool enabled) external
  ```

  Sets the strategy to enabled or disabled.

  when disabled, the strategy will be invalid for committing of new async orders.

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market associated with the strategy.
* `strategyId` (*uint256*) - id of the strategy.
* `enabled` (*bool*) - set enabled/disabled.

### getSettlementStrategy

  ```solidity
  function getSettlementStrategy(uint128 marketId, uint256 strategyId) external view returns (struct SettlementStrategy.Data settlementStrategy)
  ```

  Returns the settlement strategy data for given market/strategy id.

**Parameters**
* `marketId` (*uint128*) - Id of the market associated with the strategy.
* `strategyId` (*uint256*) - id of the strategy.

**Returns**
* `settlementStrategy` (*struct SettlementStrategy.Data*) - 

### SettlementStrategyAdded

  ```solidity
  event SettlementStrategyAdded(uint128 synthMarketId, uint256 strategyId)
  ```

  Gets fired when new settlement strategy is added.

**Parameters**
* `synthMarketId` (*uint128*) - adds settlement strategy to this specific market.
* `strategyId` (*uint256*) - the newly created settlement strategy id.

### SettlementStrategyUpdated

  ```solidity
  event SettlementStrategyUpdated(uint128 synthMarketId, uint256 strategyId, bool enabled)
  ```

  Gets fired when settlement strategy is enabled/disabled.

  currently only enabled/disabled flag can be updated.

**Parameters**
* `synthMarketId` (*uint128*) - adds settlement strategy to this specific market.
* `strategyId` (*uint256*) - id of the strategy.
* `enabled` (*bool*) - true/false.

## Async Order Module

### commitOrder

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
### cancelOrder

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

### getAsyncOrderClaim

  ```solidity
  function getAsyncOrderClaim(uint128 marketId, uint128 asyncOrderId) external view returns (struct AsyncOrderClaim.Data asyncOrderClaim)
  ```

  Get async order claim details

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `asyncOrderId` (*uint128*) - id of the async order created during commitment.

**Returns**
* `asyncOrderClaim` (*struct AsyncOrderClaim.Data*) - claim details (see AsyncOrderClaim.Data struct).

### OrderCommitted

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

### OrderCancelled

  ```solidity
  event OrderCancelled(uint128 marketId, uint128 asyncOrderId, struct AsyncOrderClaim.Data asyncOrderClaim, address sender)
  ```

  Gets fired when an order is cancelled.

**Parameters**
* `marketId` (*uint128*) - Id of the market used for the trade.
* `asyncOrderId` (*uint128*) - id of the async order.
* `asyncOrderClaim` (*struct AsyncOrderClaim.Data*) - claim details (see AsyncOrderClaim.Data struct).
* `sender` (*address*) - trader address and also the receiver of the funds.

## Async Order Settlement Module

### settleOrder

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
### settlePythOrder

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

### OrderSettled

  ```solidity
  event OrderSettled(uint128 marketId, uint128 asyncOrderId, uint256 finalOrderAmount, struct OrderFees.Data fees, uint256 collectedFees, address settler, uint256 price)
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

## Atomic Order Module

### buyExactIn

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
### buy

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
### buyExactOut

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
### quoteBuyExactIn

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
### quoteBuyExactOut

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
### sellExactIn

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
### sellExactOut

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
### sell

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
### quoteSellExactIn

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
### quoteSellExactOut

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

### SynthBought

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

### SynthSold

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

## Market Configuration Module

### getMarketFees

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
### setAtomicFixedFee

  ```solidity
  function setAtomicFixedFee(uint128 synthMarketId, uint256 atomicFixedFee) external
  ```

  sets the atomic fixed fee for a given market

  only marketOwner can set the fee

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the fee applies to.
* `atomicFixedFee` (*uint256*) - fixed fee amount represented in bips with 18 decimals.

### setAsyncFixedFee

  ```solidity
  function setAsyncFixedFee(uint128 synthMarketId, uint256 asyncFixedFee) external
  ```

  sets the async fixed fee for a given market

  only marketOwner can set the fee

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the fee applies to.
* `asyncFixedFee` (*uint256*) - fixed fee amount represented in bips with 18 decimals.

### setMarketSkewScale

  ```solidity
  function setMarketSkewScale(uint128 synthMarketId, uint256 skewScale) external
  ```

  sets the skew scale for a given market

  only marketOwner can set the skew scale

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the skew scale applies to.
* `skewScale` (*uint256*) - max amount of synth which makes the skew 100%. the fee is derived as a % of the max value.  100% premium means outstanding synth == skewScale.

### getMarketSkewScale

  ```solidity
  function getMarketSkewScale(uint128 synthMarketId) external returns (uint256 skewScale)
  ```

  gets the skew scale for a given market

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the skew scale applies to.

**Returns**
* `skewScale` (*uint256*) - max amount of synth which makes the skew 100%. the fee is derived as a % of the max value.  100% premium means outstanding synth == skewScale.
### setMarketUtilizationFees

  ```solidity
  function setMarketUtilizationFees(uint128 synthMarketId, uint256 utilizationFeeRate) external
  ```

  sets the market utilization fee for a given market

  only marketOwner can set the fee
100% utilization means the fee is 0.  120% utilization means the fee is 20% * this fee rate (in bips).

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the utilization fee applies to.
* `utilizationFeeRate` (*uint256*) - the rate is represented in bips with 18 decimals and is the rate at which fee increases based on the % above 100% utilization of the delegated collateral for the market.

### getMarketUtilizationFees

  ```solidity
  function getMarketUtilizationFees(uint128 synthMarketId) external returns (uint256 utilizationFeeRate)
  ```

  gets the market utilization fee for a given market

  100% utilization means the fee is 0.  120% utilization means the fee is 20% * this fee rate (in bips).

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the utilization fee applies to.

**Returns**
* `utilizationFeeRate` (*uint256*) - the rate is represented in bips with 18 decimals and is the rate at which fee increases based on the % above 100% utilization of the delegated collateral for the market.
### setCollateralLeverage

  ```solidity
  function setCollateralLeverage(uint128 synthMarketId, uint256 collateralLeverage) external
  ```

  sets the collateral leverage for a given market

  only marketOwner can set the leverage
this leverage value is a value applied to delegated collateral which is compared to outstanding synth to determine utilization of market, and locked amounts

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the collateral leverage applies to.
* `collateralLeverage` (*uint256*) - the leverage is represented as % with 18 decimals. 1 = 1x leverage

### getCollateralLeverage

  ```solidity
  function getCollateralLeverage(uint128 synthMarketId) external returns (uint256 collateralLeverage)
  ```

  gets the collateral leverage for a given market

  this leverage value is a value applied to delegated collateral which is compared to outstanding synth to determine utilization of market, and locked amounts

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the collateral leverage applies to.

**Returns**
* `collateralLeverage` (*uint256*) - the leverage is represented as % with 18 decimals. 1 = 1x leverage
### setCustomTransactorFees

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

### getCustomTransactorFees

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
### setFeeCollector

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

### getFeeCollector

  ```solidity
  function getFeeCollector(uint128 synthMarketId) external returns (address feeCollector)
  ```

  gets a custom fee collector for a given market

**Parameters**
* `synthMarketId` (*uint128*) - Id of the market the fee collector applies to.

**Returns**
* `feeCollector` (*address*) - address of the fee collector inheriting the IFeeCollector interface.
### setWrapperFees

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

### updateReferrerShare

  ```solidity
  function updateReferrerShare(uint128 marketId, address referrer, uint256 sharePercentage) external
  ```

  Update the referral share percentage for a given market

**Parameters**
* `marketId` (*uint128*) - id of the market
* `referrer` (*address*) - The address of the referrer
* `sharePercentage` (*uint256*) - The new share percentage for the referrer

### getReferrerShare

  ```solidity
  function getReferrerShare(uint128 marketId, address referrer) external returns (uint256 sharePercentage)
  ```

  get the referral share percentage for a given market

**Parameters**
* `marketId` (*uint128*) - id of the market
* `referrer` (*address*) - The address of the referrer

**Returns**
* `sharePercentage` (*uint256*) - The new share percentage for the referrer

### MarketUtilizationFeesSet

  ```solidity
  event MarketUtilizationFeesSet(uint256 synthMarketId, uint256 utilizationFeeRate)
  ```

  emitted when market utilization fees are set for specified market

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `utilizationFeeRate` (*uint256*) - utilization fee rate value

### MarketSkewScaleSet

  ```solidity
  event MarketSkewScaleSet(uint256 synthMarketId, uint256 skewScale)
  ```

  emitted when the skew scale is set for a market

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `skewScale` (*uint256*) - skew scale value

### CollateralLeverageSet

  ```solidity
  event CollateralLeverageSet(uint256 synthMarketId, uint256 collateralLeverage)
  ```

  emitted when the collateral leverage is set for a market

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `collateralLeverage` (*uint256*) - leverage value

### AtomicFixedFeeSet

  ```solidity
  event AtomicFixedFeeSet(uint256 synthMarketId, uint256 atomicFixedFee)
  ```

  emitted when the fixed fee for atomic orders is set.

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `atomicFixedFee` (*uint256*) - fee value

### AsyncFixedFeeSet

  ```solidity
  event AsyncFixedFeeSet(uint256 synthMarketId, uint256 asyncFixedFee)
  ```

  emitted when the fixed fee for async orders is set.

**Parameters**
* `synthMarketId` (*uint256*) - market id
* `asyncFixedFee` (*uint256*) - fee value

### TransactorFixedFeeSet

  ```solidity
  event TransactorFixedFeeSet(uint256 synthMarketId, address transactor, uint256 fixedFeeAmount)
  ```

  emitted when the fixed fee is set for a given transactor

  this overrides the async/atomic fixed fees for a given transactor

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market to set the fees for.
* `transactor` (*address*) - fixed fee for the transactor (overrides the global fixed fee)
* `fixedFeeAmount` (*uint256*) - the fixed fee for the corresponding market, and transactor

### FeeCollectorSet

  ```solidity
  event FeeCollectorSet(uint256 synthMarketId, address feeCollector)
  ```

  emitted when custom fee collector is set for a given market

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market to set the collector for.
* `feeCollector` (*address*) - the address of the fee collector to set.

### WrapperFeesSet

  ```solidity
  event WrapperFeesSet(uint256 synthMarketId, int256 wrapFee, int256 unwrapFee)
  ```

  emitted when wrapper fees are set for a given market

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market to set the wrapper fees.
* `wrapFee` (*int256*) - wrapping fee in %, 18 decimals. Can be negative.
* `unwrapFee` (*int256*) - unwrapping fee in %, 18 decimals. Can be negative.

### ReferrerShareUpdated

  ```solidity
  event ReferrerShareUpdated(uint128 marketId, address referrer, uint256 sharePercentage)
  ```

  Emitted when the owner of the market has changed.

**Parameters**
* `marketId` (*uint128*) - Id of the market
* `referrer` (*address*) - The address of the referrer
* `sharePercentage` (*uint256*) - The new share percentage for the referrer

## Spot Market Factory Module

### setSynthetix

  ```solidity
  function setSynthetix(contract ISynthetixSystem synthetix) external
  ```

  Sets the v3 synthetix core system.

  Pulls in the USDToken and oracle manager from the synthetix core system and sets those appropriately.

**Parameters**
* `synthetix` (*contract ISynthetixSystem*) - synthetix v3 core system address

### setSynthImplementation

  ```solidity
  function setSynthImplementation(address synthImplementation) external
  ```

  When a new synth is created, this is the erc20 implementation that is used.

**Parameters**
* `synthImplementation` (*address*) - erc20 implementation address

### createSynth

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
### getSynth

  ```solidity
  function getSynth(uint128 marketId) external view returns (address synthAddress)
  ```

  Get the proxy address of the synth for the provided marketId

  Uses associated systems module to retrieve the token address.

**Parameters**
* `marketId` (*uint128*) - id of the market

**Returns**
* `synthAddress` (*address*) - address of the proxy for the synth
### getSynthImpl

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
### updatePriceData

  ```solidity
  function updatePriceData(uint128 marketId, bytes32 buyFeedId, bytes32 sellFeedId) external
  ```

  Update the price data for a given market.

  Only the market owner can call this function.

**Parameters**
* `marketId` (*uint128*) - id of the market
* `buyFeedId` (*bytes32*) - the oracle manager buy feed node id
* `sellFeedId` (*bytes32*) - the oracle manager sell feed node id

### upgradeSynthImpl

  ```solidity
  function upgradeSynthImpl(uint128 marketId) external
  ```

  upgrades the synth implementation to the current implementation for the specified market.
Anyone who is willing and able to spend the gas can call this method.

  The synth implementation is upgraded via the proxy.

**Parameters**
* `marketId` (*uint128*) - id of the market

### setDecayRate

  ```solidity
  function setDecayRate(uint128 marketId, uint256 rate) external
  ```

  Allows market to adjust decay rate of the synth

**Parameters**
* `marketId` (*uint128*) - the market to update the synth decay rate for
* `rate` (*uint256*) - APY to decay of the synth to decay by, as a 18 decimal ratio

### nominateMarketOwner

  ```solidity
  function nominateMarketOwner(uint128 synthMarketId, address newNominatedOwner) external
  ```

  Allows the current market owner to nominate a new owner.

  The nominated owner will have to call `acceptOwnership` in a separate transaction in order to finalize the action and become the new contract owner.

**Parameters**
* `synthMarketId` (*uint128*) - synth market id value
* `newNominatedOwner` (*address*) - The address that is to become nominated.

### acceptMarketOwnership

  ```solidity
  function acceptMarketOwnership(uint128 synthMarketId) external
  ```

  Allows a nominated address to accept ownership of the market.

  Reverts if the caller is not nominated.

**Parameters**
* `synthMarketId` (*uint128*) - synth market id value

### renounceMarketNomination

  ```solidity
  function renounceMarketNomination(uint128 synthMarketId) external
  ```

  Allows a nominated address to renounce ownership of the market.

  Reverts if the caller is not nominated.

**Parameters**
* `synthMarketId` (*uint128*) - synth market id value

### getMarketOwner

  ```solidity
  function getMarketOwner(uint128 synthMarketId) external view returns (address)
  ```

  Returns market owner.

**Parameters**
* `synthMarketId` (*uint128*) - synth market id value

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

### SynthetixSystemSet

  ```solidity
  event SynthetixSystemSet(address synthetix, address usdTokenAddress, address oracleManager)
  ```

  Gets fired when the synthetix is set

**Parameters**
* `synthetix` (*address*) - address of the synthetix core contract
* `usdTokenAddress` (*address*) - address of the USDToken contract
* `oracleManager` (*address*) - address of the Oracle Manager contract

### SynthImplementationSet

  ```solidity
  event SynthImplementationSet(address synthImplementation)
  ```

  Gets fired when the synth implementation is set

**Parameters**
* `synthImplementation` (*address*) - address of the synth implementation

### SynthRegistered

  ```solidity
  event SynthRegistered(uint256 synthMarketId)
  ```

  Gets fired when the synth is registered as a market.

**Parameters**
* `synthMarketId` (*uint256*) - Id of the synth market that was created

### SynthImplementationUpgraded

  ```solidity
  event SynthImplementationUpgraded(uint256 synthMarketId, address proxy, address implementation)
  ```

  Gets fired when the synth's implementation is updated on the corresponding proxy.

**Parameters**
* `synthMarketId` (*uint256*) - 
* `proxy` (*address*) - the synth proxy servicing the latest implementation
* `implementation` (*address*) - the latest implementation of the synth

### SynthPriceDataUpdated

  ```solidity
  event SynthPriceDataUpdated(uint256 synthMarketId, bytes32 buyFeedId, bytes32 sellFeedId)
  ```

  Gets fired when the market's price feeds are updated, compatible with oracle manager

**Parameters**
* `synthMarketId` (*uint256*) - 
* `buyFeedId` (*bytes32*) - the oracle manager feed id for the buy price
* `sellFeedId` (*bytes32*) - the oracle manager feed id for the sell price

### DecayRateUpdated

  ```solidity
  event DecayRateUpdated(uint128 marketId, uint256 rate)
  ```

  Gets fired when the market's price feeds are updated, compatible with oracle manager

**Parameters**
* `marketId` (*uint128*) - Id of the synth market
* `rate` (*uint256*) - the new decay rate (1e16 means 1% decay per year)

### MarketOwnerNominated

  ```solidity
  event MarketOwnerNominated(uint128 marketId, address newOwner)
  ```

  Emitted when an address has been nominated.

**Parameters**
* `marketId` (*uint128*) - id of the market
* `newOwner` (*address*) - The address that has been nominated.

### MarketNominationRenounced

  ```solidity
  event MarketNominationRenounced(uint128 marketId, address nominee)
  ```

  Emitted when market nominee renounces nomination.

**Parameters**
* `marketId` (*uint128*) - id of the market
* `nominee` (*address*) - The address that has been nominated.

### MarketOwnerChanged

  ```solidity
  event MarketOwnerChanged(uint128 marketId, address oldOwner, address newOwner)
  ```

  Emitted when the owner of the market has changed.

**Parameters**
* `marketId` (*uint128*) - id of the market
* `oldOwner` (*address*) - The previous owner of the market.
* `newOwner` (*address*) - The new owner of the market.

## Synth Token Module

### setDecayRate

  ```solidity
  function setDecayRate(uint256 _rate) external
  ```

  Updates the decay rate for a year

**Parameters**
* `_rate` (*uint256*) - The decay rate with 18 decimals (1e16 means 1% decay per year).

### decayRate

  ```solidity
  function decayRate() external returns (uint256)
  ```

  get decay rate for a year

### advanceEpoch

  ```solidity
  function advanceEpoch() external returns (uint256)
  ```

  advance epoch manually in order to avoid precision loss

### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns wether the token has been initialized.

**Returns**
* `[0]` (*bool*) - A boolean with the result of the query.
### initialize

  ```solidity
  function initialize(string tokenName, string tokenSymbol, uint8 tokenDecimals) external
  ```

  Initializes the token with name, symbol, and decimals.

### mint

  ```solidity
  function mint(address to, uint256 amount) external
  ```

  Allows the owner to mint tokens.

**Parameters**
* `to` (*address*) - The address to receive the newly minted tokens.
* `amount` (*uint256*) - The amount of tokens to mint.

### burn

  ```solidity
  function burn(address from, uint256 amount) external
  ```

  Allows the owner to burn tokens.

**Parameters**
* `from` (*address*) - The address whose tokens will be burnt.
* `amount` (*uint256*) - The amount of tokens to burn.

### setAllowance

  ```solidity
  function setAllowance(address from, address spender, uint256 amount) external
  ```

  Allows an address that holds tokens to provide allowance to another.

**Parameters**
* `from` (*address*) - The address that is providing allowance.
* `spender` (*address*) - The address that is given allowance.
* `amount` (*uint256*) - The amount of allowance being given.

### name

  ```solidity
  function name() external view returns (string)
  ```

  Retrieves the name of the token, e.g. "Synthetix Network Token".

**Returns**
* `[0]` (*string*) - A string with the name of the token.
### symbol

  ```solidity
  function symbol() external view returns (string)
  ```

  Retrieves the symbol of the token, e.g. "SNX".

**Returns**
* `[0]` (*string*) - A string with the symbol of the token.
### decimals

  ```solidity
  function decimals() external view returns (uint8)
  ```

  Retrieves the number of decimals used by the token. The default is 18.

**Returns**
* `[0]` (*uint8*) - The number of decimals.
### totalSupply

  ```solidity
  function totalSupply() external view returns (uint256)
  ```

  Returns the total number of tokens in circulation (minted - burnt).

**Returns**
* `[0]` (*uint256*) - The total number of tokens.
### balanceOf

  ```solidity
  function balanceOf(address owner) external view returns (uint256)
  ```

  Returns the balance of a user.

**Parameters**
* `owner` (*address*) - The address whose balance is being retrieved.

**Returns**
* `[0]` (*uint256*) - The number of tokens owned by the user.
### allowance

  ```solidity
  function allowance(address owner, address spender) external view returns (uint256)
  ```

  Returns how many tokens a user has allowed another user to transfer on its behalf.

**Parameters**
* `owner` (*address*) - The user who has given the allowance.
* `spender` (*address*) - The user who was given the allowance.

**Returns**
* `[0]` (*uint256*) - The amount of tokens `spender` can transfer on `owner`'s behalf.
### transfer

  ```solidity
  function transfer(address to, uint256 amount) external returns (bool)
  ```

  Transfer tokens from one address to another.

**Parameters**
* `to` (*address*) - The address that will receive the tokens.
* `amount` (*uint256*) - The amount of tokens to be transferred.

**Returns**
* `[0]` (*bool*) - A boolean which is true if the operation succeeded.
### approve

  ```solidity
  function approve(address spender, uint256 amount) external returns (bool)
  ```

  Allows users to provide allowance to other users so that they can transfer tokens on their behalf.

**Parameters**
* `spender` (*address*) - The address that is receiving the allowance.
* `amount` (*uint256*) - The amount of tokens that are being added to the allowance.

**Returns**
* `[0]` (*bool*) - A boolean which is true if the operation succeeded.
### increaseAllowance

  ```solidity
  function increaseAllowance(address spender, uint256 addedValue) external returns (bool)
  ```

  Atomically increases the allowance granted to `spender` by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- `spender` cannot be the zero address.

### decreaseAllowance

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

### transferFrom

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

### Transfer

  ```solidity
  event Transfer(address from, address to, uint256 amount)
  ```

  Emitted when tokens have been transferred.

**Parameters**
* `from` (*address*) - The address that originally owned the tokens.
* `to` (*address*) - The address that received the tokens.
* `amount` (*uint256*) - The number of tokens that were transferred.

### Approval

  ```solidity
  event Approval(address owner, address spender, uint256 amount)
  ```

  Emitted when a user has provided allowance to another user for transferring tokens on its behalf.

**Parameters**
* `owner` (*address*) - The address that is providing the allowance.
* `spender` (*address*) - The address that received the allowance.
* `amount` (*uint256*) - The number of tokens that were added to `spender`'s allowance.

## Wrapper Module

### setWrapper

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

### wrap

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
### unwrap

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

### WrapperSet

  ```solidity
  event WrapperSet(uint256 synthMarketId, address wrapCollateralType, uint256 maxWrappableAmount)
  ```

  Gets fired when wrapper supply is set for a given market, collateral type.

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market the wrapper is initialized for.
* `wrapCollateralType` (*address*) - the collateral used to wrap the synth.
* `maxWrappableAmount` (*uint256*) - the local supply cap for the wrapper.

### SynthWrapped

  ```solidity
  event SynthWrapped(uint256 synthMarketId, uint256 amountWrapped, struct OrderFees.Data fees, uint256 feesCollected)
  ```

  Gets fired after user wraps synth

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market.
* `amountWrapped` (*uint256*) - amount of synth wrapped.
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction.
* `feesCollected` (*uint256*) - fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).

### SynthUnwrapped

  ```solidity
  event SynthUnwrapped(uint256 synthMarketId, uint256 amountUnwrapped, struct OrderFees.Data fees, uint256 feesCollected)
  ```

  Gets fired after user unwraps synth

**Parameters**
* `synthMarketId` (*uint256*) - Id of the market.
* `amountUnwrapped` (*uint256*) - amount of synth unwrapped.
* `fees` (*struct OrderFees.Data*) - breakdown of all the fees incurred for the transaction.
* `feesCollected` (*uint256*) - fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).

