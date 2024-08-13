import { newTypedMockEvent } from 'matchstick-as';
import { PoolNominationRenounced } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { BigInt, ethereum } from '@graphprotocol/graph-ts';

export function createPoolOwnershipRenouncedEvent(
  id: i32,
  timestamp: i64,
  blockNumber: i64
): PoolNominationRenounced {
  const newPoolOwnerNominationRenouncedEvent = newTypedMockEvent<PoolNominationRenounced>();
  const block = createBlock(timestamp, blockNumber);
  newPoolOwnerNominationRenouncedEvent.parameters = [];
  newPoolOwnerNominationRenouncedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolOwnerNominationRenouncedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolOwnerNominationRenouncedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolOwnerNominationRenouncedEvent;
}
