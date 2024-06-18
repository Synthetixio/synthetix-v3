import { newTypedMockEvent } from 'matchstick-as';
import { RewardsClaimed } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createRewardsClaimedEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  distributor: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): RewardsClaimed {
  const newRewardsClaimedEvent = newTypedMockEvent<RewardsClaimed>();
  const block = createBlock(timestamp, blockNumber);
  newRewardsClaimedEvent.logIndex = BigInt.fromI32(logIndex);
  newRewardsClaimedEvent.parameters = [];
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam(
      'distributor',
      ethereum.Value.fromAddress(Address.fromString(distributor))
    )
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newRewardsClaimedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsClaimedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsClaimedEvent;
}
