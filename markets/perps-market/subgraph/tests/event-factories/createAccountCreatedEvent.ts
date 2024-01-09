import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { AccountCreated } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createAccountCreatedEvent(
  id: i32,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): AccountCreated {
  const event = newTypedMockEvent<AccountCreated>();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('accountId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  return event;
}
