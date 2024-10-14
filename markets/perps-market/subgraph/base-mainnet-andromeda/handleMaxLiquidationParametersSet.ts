import { MaxLiquidationParametersSet } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Market } from './generated/schema';

export function handleMaxLiquidationParametersSet(event: MaxLiquidationParametersSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.maxLiquidationLimitAccumulationMultiplier =
      event.params.maxLiquidationLimitAccumulationMultiplier;
    market.maxSecondsInLiquidationWindow = event.params.maxSecondsInLiquidationWindow;
    market.maxLiquidationPd = event.params.maxLiquidationPd;
    market.endorsedLiquidator = event.params.endorsedLiquidator.toHexString();

    market.save();
  }
}
