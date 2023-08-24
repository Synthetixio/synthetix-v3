import {
  SettlementStrategyAdded,
  SpotMarketProxy,
} from '../generated/SpotMarketProxy/SpotMarketProxy';
import { SettlementStrategy } from '../generated/schema';

export function handleSettlementStrategyAdded(event: SettlementStrategyAdded): void {
  let id = event.params.strategyId.toString();
  let strategy = new SettlementStrategy(id);

  let strategyInfo = SpotMarketProxy.bind(event.address).getSettlementStrategy(
    event.params.synthMarketId,
    event.params.strategyId
  );

  strategy.marketId = event.params.synthMarketId;
  strategy.settlementStrategyId = event.params.strategyId;

  strategy.strategyType = strategyInfo.strategyType;
  strategy.settlementDelay = strategyInfo.settlementDelay;
  strategy.settlementWindowDuration = strategyInfo.settlementWindowDuration;
  strategy.priceVerificationContract = strategyInfo.priceVerificationContract.toHexString();
  strategy.feedId = strategyInfo.feedId;
  strategy.url = strategyInfo.url;
  strategy.settlementReward = strategyInfo.settlementReward;
  strategy.priceDeviationTolerance = strategyInfo.priceDeviationTolerance;
  strategy.minimumUsdExchangeAmount = strategyInfo.minimumUsdExchangeAmount;
  strategy.maxRoundingLoss = strategyInfo.maxRoundingLoss;
  strategy.disabled = strategyInfo.disabled;

  strategy.save();
}
