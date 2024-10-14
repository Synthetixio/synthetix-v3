import { SettlementStrategySet } from './generated/SpotMarketProxy/SpotMarketProxy';
import { SettlementStrategy } from './generated/schema';

export function handleSettlementStrategySet(event: SettlementStrategySet): void {
  let id = event.params.strategyId.toString();
  let strategy = SettlementStrategy.load(id);
  if (!strategy) {
    return;
  }

  strategy.strategyType = event.params.strategy.strategyType;
  strategy.settlementDelay = event.params.strategy.settlementDelay;
  strategy.settlementWindowDuration = event.params.strategy.settlementWindowDuration;
  strategy.priceVerificationContract =
    event.params.strategy.priceVerificationContract.toHexString();
  strategy.feedId = event.params.strategy.feedId;
  strategy.url = event.params.strategy.url;
  strategy.settlementReward = event.params.strategy.settlementReward;
  strategy.minimumUsdExchangeAmount = event.params.strategy.minimumUsdExchangeAmount;
  strategy.maxRoundingLoss = event.params.strategy.maxRoundingLoss;
  strategy.disabled = event.params.strategy.disabled;

  strategy.save();
}
