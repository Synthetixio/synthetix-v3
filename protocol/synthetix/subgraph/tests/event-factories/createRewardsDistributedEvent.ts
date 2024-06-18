import { newTypedMockEvent } from 'matchstick-as';
import { RewardsDistributed } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export function createRewardsDistributedEvent(
  poolId: i32,
  collateralType: string,
  distributor: string,
  amount: i64,
  start: i64,
  duration: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): RewardsDistributed {
  const newRewardsDistributedEvent = newTypedMockEvent<RewardsDistributed>();
  const block = createBlock(timestamp, blockNumber);
  newRewardsDistributedEvent.logIndex = BigInt.fromI32(logIndex);
  newRewardsDistributedEvent.parameters = [];
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam(
      'distributor',
      ethereum.Value.fromAddress(Address.fromString(distributor))
    )
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('start', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(start)))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('duration', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(duration)))
  );
  newRewardsDistributedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsDistributedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsDistributedEvent;
}
