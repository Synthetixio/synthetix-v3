import { newTypedMockEvent } from 'matchstick-as';
import { CollateralConfigured } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { address } from '../constants';

export function createCollateralConfiguredEvent(
  collateralType: string,
  depositingEnabled: boolean,
  issuanceRatio: i32,
  liquidationRatio: i32,
  liquidationReward: i32,
  oracleNodeId: i32,
  minDelegation: i32,
  timestamp: i64,
  blockNumber: i64
): CollateralConfigured {
  const newUsdWithdrawnEvent = newTypedMockEvent<CollateralConfigured>();
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = [];
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromBoolean(depositingEnabled),
    ethereum.Value.fromI32(issuanceRatio),
    ethereum.Value.fromI32(liquidationRatio),
    ethereum.Value.fromI32(liquidationReward),
    ethereum.Value.fromBytes(Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(oracleNodeId)))),
    ethereum.Value.fromAddress(Address.fromString(address)),
    ethereum.Value.fromI32(minDelegation),
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);
  newUsdWithdrawnEvent.parameters.push(new ethereum.EventParam('config', tupleValue));
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}
