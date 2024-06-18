import { newTypedMockEvent } from 'matchstick-as';
import { RewardsDistributorRemoved } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export function createRewardsDistributorRemovedEvent(
  poolId: i32,
  collateralType: string,
  distributor: string,
  timestamp: i64,
  blockNumber: i64
): RewardsDistributorRemoved {
  const newRewardsDistributorRemovedEvent = newTypedMockEvent<RewardsDistributorRemoved>();
  const block = createBlock(timestamp, blockNumber);
  newRewardsDistributorRemovedEvent.parameters = [];
  newRewardsDistributorRemovedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newRewardsDistributorRemovedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newRewardsDistributorRemovedEvent.parameters.push(
    new ethereum.EventParam(
      'distributor',
      ethereum.Value.fromAddress(Address.fromString(distributor))
    )
  );

  newRewardsDistributorRemovedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsDistributorRemovedEvent.block.number = BigInt.fromI64(block['blockNumber']);

  return newRewardsDistributorRemovedEvent;
}
