import { newTypedMockEvent } from 'matchstick-as';
import { PoolNameUpdated } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createPoolNameUpdatedEvent(
  id: i32,
  name: string,
  timestamp: i64,
  blockNumber: i64
): PoolNameUpdated {
  const newPoolNameUpdatedEvent = newTypedMockEvent<PoolNameUpdated>();
  const block = createBlock(timestamp, blockNumber);
  newPoolNameUpdatedEvent.parameters = [];
  newPoolNameUpdatedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolNameUpdatedEvent.parameters.push(
    new ethereum.EventParam('name', ethereum.Value.fromString(name))
  );
  newPoolNameUpdatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolNameUpdatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolNameUpdatedEvent;
}
