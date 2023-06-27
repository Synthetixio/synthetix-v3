import {
  MarketPriceDataUpdated,
  MarketOwnerChanged,
  MarketRegistered,
  FundingParametersSet,
  LiquidationParametersSet,
  LockedOiPercentSet,
  OrderFeesSet,
} from "../generated/PerpsMarket/PerpsMarketProxy";

import { Market } from "../generated/schema";

export function handleMarketRegistered(event: MarketRegistered): void {
  let id = event.params.perpsMarketId.toString();
  let market = new Market(id);

  market.perpsMarketId = event.params.perpsMarketId;
  market.marketOwner = event.params.marketOwner.toHexString();
  market.marketName = event.params.marketName;
  market.marketSymbol = event.params.marketSymbol;
  market.save();
}

export function handleMarketPriceDataUpdated(
  event: MarketPriceDataUpdated
): void {
  let id = event.params.perpsMarketId.toString();
  let market = Market.load(id);

  if (market) {
    market.feedId = event.params.feedId;
    market.save();
  }
}

export function handleMarketOwnerChanged(event: MarketOwnerChanged): void {
  let id = event.params.perpsMarketId.toString();
  let market = Market.load(id);

  if (market) {
    market.owner = event.params.newOwner.toHexString();
    market.save();
  }
}

export function handleFundingParametersSet(event: FundingParametersSet): void {
  let id = event.params.marketId.toString();
  let market = Market.load(id);

  if (market) {
    market.maxFundingVelocity = event.params.maxFundingVelocity;
    market.skewScale = event.params.skewScale;
    market.save();
  }
}

export function handleLockedOiPercentSet(event: LockedOiPercentSet): void {
  let id = event.params.marketId.toString();
  let market = Market.load(id);

  if (market) {
    market.lockedOiPercent = event.params.lockedOiPercent;
    market.save();
  }
}

export function handleLiquidationParametersSet(
  event: LiquidationParametersSet
): void {
  let id = event.params.marketId.toString();
  let market = Market.load(id);

  if (market) {
    market.initialMarginFraction = event.params.initialMarginFraction;
    market.liquidationRewardRatioD18 = event.params.liquidationRewardRatioD18;
    market.maintenanceMarginFraction = event.params.maintenanceMarginFraction;
    market.maxLiquidationLimitAccumulationMultiplier =
      event.params.maxLiquidationLimitAccumulationMultiplier;
    market.save();
  }
}

export function handleOrderFeesSet(event: OrderFeesSet): void {
  let id = event.params.marketId.toString();
  let market = Market.load(id);

  if (market) {
    market.makerFee = event.params.makerFeeRatio;
    market.takerFee = event.params.takerFeeRatio;
    market.save();
  }
}
