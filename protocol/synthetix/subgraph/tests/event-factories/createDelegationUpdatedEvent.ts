import { newTypedMockEvent } from 'matchstick-as';
import { DelegationUpdated } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createDelegationUpdateEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  amount: i64,
  leverage: i32,
  timestamp: i64,
  blockNumber: i64
): DelegationUpdated {
  const newDelegationUpdatedEvent = newTypedMockEvent<DelegationUpdated>();
  const block = createBlock(timestamp, blockNumber);
  newDelegationUpdatedEvent.parameters = [];
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('leverage', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(leverage)))
  );
  newDelegationUpdatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newDelegationUpdatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newDelegationUpdatedEvent;
}
