import { OrderFeesSet } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Market } from './generated/schema';

export function handleOrderFeesSet(event: OrderFeesSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.makerFee = event.params.makerFeeRatio;
    market.takerFee = event.params.takerFeeRatio;
    market.save();
  }
}
