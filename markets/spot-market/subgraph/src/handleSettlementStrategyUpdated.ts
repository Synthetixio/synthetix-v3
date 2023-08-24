import {
  SettlementStrategyUpdated,
  SpotMarketProxy,
} from '../generated/SpotMarketProxy/SpotMarketProxy';
import { SettlementStrategy } from '../generated/schema';

export function handleSettlementStrategyUpdated(event: SettlementStrategyUpdated): void {
  let id = event.params.strategyId.toString();
  let strategy = SettlementStrategy.load(id);

  if (!strategy) {
    return;
  }

  let strategyInfo = SpotMarketProxy.bind(event.address).getSettlementStrategy(
    event.params.synthMarketId,
    event.params.strategyId
  );

  strategy.disabled = strategyInfo.disabled;
  strategy.save();
}
