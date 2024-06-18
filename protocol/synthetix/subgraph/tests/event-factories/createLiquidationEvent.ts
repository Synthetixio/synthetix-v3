import { newTypedMockEvent } from 'matchstick-as';
import { Liquidation } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createLiquidationEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  debtLiquidated: i64,
  collateralLiquidated: i64,
  amountRewarded: i64,
  liquidateAsAccountId: i64,
  sender: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): Liquidation {
  const newLiquidatedEvent = newTypedMockEvent<Liquidation>();
  const block = createBlock(timestamp, blockNumber);
  newLiquidatedEvent.logIndex = BigInt.fromI32(logIndex);
  newLiquidatedEvent.parameters = [];
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(debtLiquidated)),
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(collateralLiquidated)),
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(amountRewarded)),
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);
  newLiquidatedEvent.parameters.push(new ethereum.EventParam('liquidationData', tupleValue));
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam(
      'liquidateAsAccountId',
      ethereum.Value.fromSignedBigInt(BigInt.fromI64(liquidateAsAccountId))
    )
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );
  newLiquidatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newLiquidatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newLiquidatedEvent;
}
