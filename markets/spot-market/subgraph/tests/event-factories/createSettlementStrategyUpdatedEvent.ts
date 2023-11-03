import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { SettlementStrategyUpdated as SettlementStrategyUpdatedEvent } from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createSettlementStrategyUpdatedEvent(
  synthMarketId: i32,
  strategyId: i64,
  enabled: boolean,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): SettlementStrategyUpdatedEvent {
  const event = newTypedMockEvent<SettlementStrategyUpdatedEvent>();

  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam('synthMarketId', ethereum.Value.fromI32(synthMarketId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      'strategyId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(strategyId))
    )
  );
  event.parameters.push(new ethereum.EventParam('enabled', ethereum.Value.fromBoolean(enabled)));

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
