import { MaxLiquidationParametersSet } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Market } from './generated/schema';

export function handleMaxLiquidationParametersSet(event: MaxLiquidationParametersSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.maxSecondsInLiquidationWindow = event.params.maxSecondsInLiquidationWindow;
    market.maxLiquidationLimitAccumulationMultiplier =
      event.params.maxLiquidationLimitAccumulationMultiplier;
    market.save();
  }
}
