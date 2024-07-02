import { newTypedMockEvent } from 'matchstick-as';
import { PoolOwnershipAccepted } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createPoolOwnershipAcceptedEvent(
  id: i32,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): PoolOwnershipAccepted {
  const newPoolOwnershipAcceptedEvent = newTypedMockEvent<PoolOwnershipAccepted>();
  const block = createBlock(timestamp, blockNumber);
  newPoolOwnershipAcceptedEvent.parameters = [];
  newPoolOwnershipAcceptedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolOwnershipAcceptedEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  newPoolOwnershipAcceptedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolOwnershipAcceptedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolOwnershipAcceptedEvent;
}
