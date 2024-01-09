import { LiquidationParametersSet } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Market } from './generated/schema';

export function handleLiquidationParametersSet(event: LiquidationParametersSet): void {
  const id = event.params.marketId.toString();
  const market = Market.load(id);

  if (market) {
    market.initialMarginRatioD18 = event.params.initialMarginRatioD18;
    market.liquidationRewardRatioD18 = event.params.liquidationRewardRatioD18;
    market.maintenanceMarginRatioD18 = event.params.maintenanceMarginRatioD18;
    market.minimumPositionMargin = event.params.minimumPositionMargin;
    market.save();
  }
}
