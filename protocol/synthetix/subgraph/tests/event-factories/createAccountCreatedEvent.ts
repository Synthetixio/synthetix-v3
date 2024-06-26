import { newTypedMockEvent } from 'matchstick-as';
import { AccountCreated } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export function createAccountCreatedEvent(
  id: i32,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): AccountCreated {
  const newMarketRegisteredEvent = newTypedMockEvent<AccountCreated>();
  const block = createBlock(timestamp, blockNumber);
  newMarketRegisteredEvent.parameters = [];

  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromI32(id))
  );
  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  newMarketRegisteredEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newMarketRegisteredEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newMarketRegisteredEvent;
}
