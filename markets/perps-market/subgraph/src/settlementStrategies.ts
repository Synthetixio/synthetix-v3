import {
  SettlementStrategyAdded,
  SettlementStrategyEnabled,
} from "../generated/PerpsMarket/PerpsMarketProxy";

import { SettlementStrategy } from "../generated/schema";

export function handleSettlementStrategyAdded(
  event: SettlementStrategyAdded
): void {
  let id =
    event.params.strategyId.toString() + "-" + event.params.marketId.toString();
  let strategy = new SettlementStrategy(id);

  strategy.strategyId = event.params.strategyId;
  strategy.marketId = event.params.marketId;

  strategy.strategyType = event.params.strategy.strategyType;
  strategy.settlementDelay = event.params.strategy.settlementDelay;
  strategy.settlementWindowDuration =
    event.params.strategy.settlementWindowDuration;
  strategy.priceVerificationContract =
    event.params.strategy.priceVerificationContract.toHexString();
  strategy.feedId = event.params.strategy.feedId;
  strategy.url = event.params.strategy.url;
  strategy.settlementReward = event.params.strategy.settlementReward;
  strategy.priceDeviationTolerance =
    event.params.strategy.priceDeviationTolerance;

  strategy.save();
}

export function handleSettlementStrategyEnabled(
  event: SettlementStrategyEnabled
): void {
  let id =
    event.params.strategyId.toString() + "-" + event.params.marketId.toString();
  let strategy = SettlementStrategy.load(id);

  if (!strategy) {
    return;
  }

  strategy.enabled = event.params.enabled;
  strategy.save();
}
