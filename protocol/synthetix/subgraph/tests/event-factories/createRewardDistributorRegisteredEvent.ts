import { newTypedMockEvent } from 'matchstick-as';
import { RewardsDistributorRegistered } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createRewardsDistributorRegisteredEvent(
  poolId: i32,
  collateralType: string,
  distributor: string,
  timestamp: i64,
  blockNumber: i64
): RewardsDistributorRegistered {
  const newRewardsDistributorRegisteredEvent = newTypedMockEvent<RewardsDistributorRegistered>();
  const block = createBlock(timestamp, blockNumber);
  newRewardsDistributorRegisteredEvent.parameters = [];
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromAddress(Address.fromString(distributor)))
  );
  newRewardsDistributorRegisteredEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsDistributorRegisteredEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsDistributorRegisteredEvent;
}
