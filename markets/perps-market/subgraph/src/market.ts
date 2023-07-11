import {
  MarketPriceDataUpdated,
  MarketOwnerChanged,
  MarketRegistered,
  FundingParametersSet,
  LiquidationParametersSet,
  OrderFeesSet,
  LockedOiRatioD18Set,
} from '../generated/PerpsMarket/PerpsMarketProxy';

import { Market } from '../generated/schema';

export function handleMarketRegistered(event: MarketRegistered): void {
  const id = event.params.perpsMarketId.toString();
  const market = new Market(id);

  market.perpsMarketId = event.params.perpsMarketId;
  market.marketOwner = event.params.marketOwner.toHexString();
  market.marketName = event.params.marketName;
  market.marketSymbol = event.params.marketSymbol;
  market.save();
}

export function handleMarketPriceDataUpdated(event: MarketPriceDataUpdated): void {
  const id = event.params.perpsMarketId.toString();
  const market = Market.load(id);

  if (market) {
    market.feedId = event.params.feedId;
    market.save();
  }
}

export function handleMarketOwnerChanged(event: MarketOwnerChanged): void {
  const id = event.params.perpsMarketId.toString();
  const market = Market.load(id);

  if (market) {
    market.owner = event.params.newOwner.toHexString();
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

export function handleLockedOiRatioD18Set(event: LockedOiRatioD18Set): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.lockedOiRatioD18 = event.params.lockedOiRatioD18;
    market.save();
  }
}

export function handleLiquidationParametersSet(event: LiquidationParametersSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.initialMarginRatioD18 = event.params.initialMarginRatioD18;
    market.maintenanceMarginRatioD18 = event.params.maintenanceMarginRatioD18;
    market.liquidationRewardRatioD18 = event.params.liquidationRewardRatioD18;
    market.maxLiquidationLimitAccumulationMultiplier =
      event.params.maxLiquidationLimitAccumulationMultiplier;
    market.maxSecondsInLiquidationWindow = event.params.maxSecondsInLiquidationWindow;
    market.minimumPositionMargin = event.params.minimumPositionMargin;
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
