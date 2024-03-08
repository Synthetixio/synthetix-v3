import { SettlementStrategyUpdated } from './generated/SpotMarketProxy/SpotMarketProxy';
import { SettlementStrategy } from './generated/schema';

export function handleSettlementStrategyUpdated(event: SettlementStrategyUpdated): void {
  let id = event.params.strategyId.toString();
  let strategy = SettlementStrategy.load(id);
  if (!strategy) {
    return;
  }
  strategy.disabled = !event.params.enabled;
  strategy.save();
}
