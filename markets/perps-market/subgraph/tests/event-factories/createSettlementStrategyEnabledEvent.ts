import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { SettlementStrategyEnabled as SettlementStrategyEnabledEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createSettlementStrategyEnabledEvent(
  marketId: i32,
  strategyId: i32,
  enabled: boolean,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): SettlementStrategyEnabledEvent {
  const event = newTypedMockEvent<SettlementStrategyEnabledEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(new ethereum.EventParam('strategyId', ethereum.Value.fromI32(strategyId)));
  event.parameters.push(new ethereum.EventParam('enabled', ethereum.Value.fromBoolean(enabled)));

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
