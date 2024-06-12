import { newTypedMockEvent } from 'matchstick-as';
import { UsdMinted } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export function createUSDMintedEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64
): UsdMinted {
  const newUSDMintedEvent = newTypedMockEvent<UsdMinted>();
  const block = createBlock(timestamp, blockNumber);
  newUSDMintedEvent.parameters = [];
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newUSDMintedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUSDMintedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUSDMintedEvent;
}
