import {
  MarketPriceDataUpdated,
  MarketOwnerChanged,
  MarketRegistered,
  FundingParametersSet,
  LiquidationParametersSet,
  LockedOiRatioD18Set,
  OrderFeesSet,
} from '../generated/PerpsMarketProxy/PerpsMarketProxy';

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
    market.lockedOiPercent = event.params.lockedOiRatioD18;
    market.save();
  }
}

export function handleLiquidationParametersSet(event: LiquidationParametersSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.initialMarginFraction = event.params.initialMarginRatioD18;
    market.liquidationRewardRatioD18 = event.params.liquidationRewardRatioD18;
    market.maintenanceMarginFraction = event.params.maintenanceMarginRatioD18;
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
