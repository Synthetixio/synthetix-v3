import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as';
import { SettlementStrategyAdded as SettlementStrategyAddedEvent } from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createSettlementStrategyAddedEvent(
  id: i32,
  strategyId: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): SettlementStrategyAddedEvent {
  const event = changetype<SettlementStrategyAddedEvent>(newMockEvent());

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('synthMarketId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam(
      'strategyId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(strategyId))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
