import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { Deposited } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';

export function createDepositEvent(
  accountId: i64,
  collateralType: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64
): Deposited {
  const newUsdWithdrawnEvent = newTypedMockEvent<Deposited>();
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = [];
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromSignedBigInt(BigInt.fromI64(accountId)))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}
