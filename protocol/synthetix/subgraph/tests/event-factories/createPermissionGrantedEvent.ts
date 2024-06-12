import { newTypedMockEvent } from 'matchstick-as';
import { PermissionGranted } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createPermissionGrantedEvent(
  accountId: i64,
  user: string,
  permissions: i64,
  timestamp: i64,
  blockNumber: i64
): PermissionGranted {
  const newUsdWithdrawnEvent = newTypedMockEvent<PermissionGranted>();
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = [];
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromSignedBigInt(BigInt.fromI64(accountId)))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      'permissions',
      ethereum.Value.fromBytes(Bytes.fromByteArray(Bytes.fromI64(permissions)))
    )
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString(user)))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}
