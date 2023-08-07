import {
  MarketPriceDataUpdated,
  MarketCreated,
  FundingParametersSet,
  LiquidationParametersSet,
  LockedOiRatioSet,
  OrderFeesSet,
  MarketUpdated,
  FactoryInitialized,
} from '../generated/PerpsMarketProxy/PerpsMarketProxy';

import { Market } from '../generated/schema';

export function handleMarketCreated(event: MarketCreated): void {
  const id = event.params.perpsMarketId.toString();
  const market = new Market(id);

  market.perpsMarketId = event.params.perpsMarketId;
  market.marketName = event.params.marketName;
  market.marketSymbol = event.params.marketSymbol;
  market.save();
}

export function handleMarketUpdated(event: MarketUpdated): void {
  const id = event.params.marketId.toString();
  const market = new Market(id);

  market.price = event.params.price;
  market.skew = event.params.skew;
  market.size = event.params.size;
  market.sizeDelta = event.params.sizeDelta;
  market.currentFundingRate = event.params.currentFundingRate;
  market.currentFundingVelocity = event.params.currentFundingVelocity;
  market.save();
}

export function handleMarketPriceDataUpdated(event: MarketPriceDataUpdated): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.feedId = event.params.feedId;
    market.save();
  }
}

export function handleFundingParametersSet(event: FundingParametersSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.maxFundingVelocity = event.params.maxFundingVelocity;
    market.skewScale = event.params.skewScale;
    market.save();
  }
}

export function handleLockedOiRatioSet(event: LockedOiRatioSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.lockedOiPercent = event.params.lockedOiRatioD18;
    market.save();
  }
}

export function handleLiquidationParametersSet(event: LiquidationParametersSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.initialMarginRatioD18 = event.params.initialMarginRatioD18;
    market.liquidationRewardRatioD18 = event.params.liquidationRewardRatioD18;
    market.maintenanceMarginRatioD18 = event.params.maintenanceMarginRatioD18;
    market.maxSecondsInLiquidationWindow = event.params.maxSecondsInLiquidationWindow;
    market.minimumPositionMargin = event.params.minimumPositionMargin;
    market.maxLiquidationLimitAccumulationMultiplier =
      event.params.maxLiquidationLimitAccumulationMultiplier;
    market.save();
  }
}

export function handleOrderFeesSet(event: OrderFeesSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.makerFee = event.params.makerFeeRatio;
    market.takerFee = event.params.takerFeeRatio;
    market.save();
  }
}
