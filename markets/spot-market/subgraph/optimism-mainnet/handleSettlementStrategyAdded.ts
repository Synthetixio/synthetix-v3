import { SettlementStrategyAdded } from './generated/SpotMarketProxy/SpotMarketProxy';
import { SettlementStrategy } from './generated/schema';

export function handleSettlementStrategyAdded(event: SettlementStrategyAdded): void {
  let id = event.params.strategyId.toString();
  let strategy = new SettlementStrategy(id);

  strategy.marketId = event.params.synthMarketId;
  strategy.settlementStrategyId = event.params.strategyId;

  strategy.disabled = false; // TODO: this value MUST be present, but impossible to get from the event data. tis is a WRONG made up value

  // TODO: this info should be part of the event, same as for perps market
  // strategy.strategyType = strategyInfo.strategyType;
  // strategy.settlementDelay = strategyInfo.settlementDelay;
  // strategy.settlementWindowDuration = strategyInfo.settlementWindowDuration;
  // strategy.priceVerificationContract = strategyInfo.priceVerificationContract.toHexString();
  // strategy.feedId = strategyInfo.feedId;
  // strategy.url = strategyInfo.url;
  // strategy.settlementReward = strategyInfo.settlementReward;
  // strategy.minimumUsdExchangeAmount = strategyInfo.minimumUsdExchangeAmount;
  // strategy.maxRoundingLoss = strategyInfo.maxRoundingLoss;
  // strategy.disabled = strategyInfo.disabled;

  strategy.save();
}
