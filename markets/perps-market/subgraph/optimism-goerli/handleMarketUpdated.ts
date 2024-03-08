import { MarketUpdated as MarketUpdatedEvent } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Market, MarketUpdated } from './generated/schema';

export function handleMarketUpdated(event: MarketUpdatedEvent): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (!market) {
    return;
  }

  market.price = event.params.price;
  market.skew = event.params.skew;
  market.size = event.params.size;
  market.sizeDelta = event.params.sizeDelta;
  market.currentFundingRate = event.params.currentFundingRate;
  market.currentFundingVelocity = event.params.currentFundingVelocity;

  market.save();

  // create MarketUpdated entity
  const marketUpdatedId =
    event.params.marketId.toString() +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();

  let marketUpdated = new MarketUpdated(marketUpdatedId);

  marketUpdated.timestamp = event.block.timestamp;
  marketUpdated.marketId = event.params.marketId;
  marketUpdated.price = event.params.price;
  marketUpdated.skew = event.params.skew;
  marketUpdated.size = event.params.size;
  marketUpdated.sizeDelta = event.params.sizeDelta;
  marketUpdated.currentFundingRate = event.params.currentFundingRate;
  marketUpdated.currentFundingVelocity = event.params.currentFundingVelocity;

  marketUpdated.save();
}
