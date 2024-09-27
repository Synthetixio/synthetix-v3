import { SettlementStrategyAdded } from './generated/SpotMarketProxy/SpotMarketProxy';
import { SettlementStrategy } from './generated/schema';

export function handleSettlementStrategyAdded(event: SettlementStrategyAdded): void {
  let id = event.params.strategyId.toString();
  let strategy = new SettlementStrategy(id);

  strategy.marketId = event.params.synthMarketId;
  strategy.settlementStrategyId = event.params.strategyId;

  // TODO: this value MUST be present,
  //   but impossible to get from the event data.
  //   tis is a WRONG made up value
  strategy.disabled = true;

  strategy.save();
}
