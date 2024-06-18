import { newTypedMockEvent } from 'matchstick-as';
import { UsdBurned } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export function createUSDBurnedEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64
): UsdBurned {
  const newUSDBurnedEvent = newTypedMockEvent<UsdBurned>();
  const block = createBlock(timestamp, blockNumber);
  newUSDBurnedEvent.parameters = [];
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newUSDBurnedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUSDBurnedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUSDBurnedEvent;
}
