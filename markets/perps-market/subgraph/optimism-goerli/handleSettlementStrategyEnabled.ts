import { SettlementStrategyEnabled } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { SettlementStrategy } from './generated/schema';

export function handleSettlementStrategyEnabled(event: SettlementStrategyEnabled): void {
  const id = event.params.strategyId.toString() + '-' + event.params.marketId.toString();
  const strategy = SettlementStrategy.load(id);

  if (!strategy) {
    return;
  }

  strategy.enabled = event.params.enabled;
  strategy.save();
}
