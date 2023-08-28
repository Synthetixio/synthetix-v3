import { LockedOiRatioSet } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Market } from './generated/schema';

export function handleLockedOiRatioSet(event: LockedOiRatioSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.lockedOiPercent = event.params.lockedOiRatioD18;
    market.save();
  }
}
