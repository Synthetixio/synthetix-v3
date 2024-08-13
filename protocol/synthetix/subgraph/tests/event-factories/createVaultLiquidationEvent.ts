import { newTypedMockEvent } from 'matchstick-as';
import { VaultLiquidation } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export function createVaultLiquidationEvent(
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
): VaultLiquidation {
  const newVaultLiquidationEvent = newTypedMockEvent<VaultLiquidation>();
  const block = createBlock(timestamp, blockNumber);
  newVaultLiquidationEvent.logIndex = BigInt.fromI32(logIndex);
  newVaultLiquidationEvent.parameters = [];
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newVaultLiquidationEvent.parameters.push(
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
  newVaultLiquidationEvent.parameters.push(new ethereum.EventParam('liquidationData', tupleValue));
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam(
      'liquidateAsAccountId',
      ethereum.Value.fromSignedBigInt(BigInt.fromI64(liquidateAsAccountId))
    )
  );
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );
  newVaultLiquidationEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newVaultLiquidationEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newVaultLiquidationEvent;
}
