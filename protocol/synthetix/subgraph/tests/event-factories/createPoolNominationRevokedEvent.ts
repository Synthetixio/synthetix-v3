import { newTypedMockEvent } from 'matchstick-as';
import { PoolNominationRevoked } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createPoolNominationRevokedEvent(
  id: i32,
  timestamp: i64,
  blockNumber: i64
): PoolNominationRevoked {
  const newPoolNominationRevokedEvent = newTypedMockEvent<PoolNominationRevoked>();
  const block = createBlock(timestamp, blockNumber);
  newPoolNominationRevokedEvent.parameters = [];
  newPoolNominationRevokedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolNominationRevokedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolNominationRevokedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolNominationRevokedEvent;
}
