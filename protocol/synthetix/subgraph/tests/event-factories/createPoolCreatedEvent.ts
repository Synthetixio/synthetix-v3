import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { newTypedMockEvent } from 'matchstick-as';
import { createBlock } from './utils';

export function createPoolCreatedEvent(
  id: i32,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): PoolCreated {
  const newPoolCreatedEvent = newTypedMockEvent<PoolCreated>();
  const block = createBlock(timestamp, blockNumber);
  newPoolCreatedEvent.parameters = [];
  newPoolCreatedEvent.parameters.push(new ethereum.EventParam('id', ethereum.Value.fromI32(id)));
  newPoolCreatedEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  newPoolCreatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolCreatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolCreatedEvent;
}
