import { MarketPriceDataUpdated } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Market } from './generated/schema';

export function handleMarketPriceDataUpdated(event: MarketPriceDataUpdated): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.feedId = event.params.feedId;
    market.save();
  }
}
