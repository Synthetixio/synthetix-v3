import { SynthPriceDataUpdated } from './generated/SpotMarketProxy/SpotMarketProxy';
import { MarketInfo } from './generated/schema';

export function handleSynthPriceDataUpdated(event: SynthPriceDataUpdated): void {
  let id = event.params.synthMarketId.toString();
  let marketInfo = MarketInfo.load(id);

  if (!marketInfo) {
    marketInfo = new MarketInfo(id);
  }

  marketInfo.marketId = event.params.synthMarketId;
  marketInfo.sellFeedId = event.params.sellFeedId;
  marketInfo.buyFeedId = event.params.buyFeedId;
  marketInfo.save();
}
