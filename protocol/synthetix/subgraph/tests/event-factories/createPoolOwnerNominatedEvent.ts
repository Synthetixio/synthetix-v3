import { newTypedMockEvent } from 'matchstick-as';
import { PoolOwnerNominated } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export function createPoolOwnerNominatedEvent(
  id: i32,
  nominee: string,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): PoolOwnerNominated {
  const newCreateNominatedPoolOwnerEvent = newTypedMockEvent<PoolOwnerNominated>();
  const block = createBlock(timestamp, blockNumber);
  newCreateNominatedPoolOwnerEvent.parameters = [];
  newCreateNominatedPoolOwnerEvent.parameters.push(
    new ethereum.EventParam('id', ethereum.Value.fromI32(id))
  );
  newCreateNominatedPoolOwnerEvent.parameters.push(
    new ethereum.EventParam(
      'nominatedOwner',
      ethereum.Value.fromAddress(Address.fromString(nominee))
    )
  );
  newCreateNominatedPoolOwnerEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  newCreateNominatedPoolOwnerEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newCreateNominatedPoolOwnerEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newCreateNominatedPoolOwnerEvent;
}
