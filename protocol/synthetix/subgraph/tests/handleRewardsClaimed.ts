import { assert } from 'matchstick-as';
import { Address, BigInt, store } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import {
  handleRewardsClaimed,
  handleRewardsDistributed,
  handleRewardsDistributorRegistered,
  handlePoolCreated,
} from '../mainnet';
import {
  createRewardsClaimedEvent,
  createRewardsDistributedEvent,
  createRewardsDistributorRegisteredEvent,
  createPoolCreatedEvent,
} from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
  handlePoolCreated(newPoolEvent);

  const rewardsClaimed = createRewardsClaimedEvent(1, 2, address, address2, 500, now, now - 1000);

  const rewardsDistributedEvent = createRewardsDistributedEvent(
    2,
    address,
    address2,
    200,
    now,
    300,
    now,
    now - 1000
  );

  const rewardsDistributorRegisteredEvent = createRewardsDistributorRegisteredEvent(
    1,
    address,
    address2,
    now,
    now - 1000
  );

  handleRewardsDistributorRegistered(rewardsDistributorRegisteredEvent);

  handleRewardsDistributed(rewardsDistributedEvent);
  assert.assertNull(
    store.get('AccountRewardsDistributor', `2-${address}-${address2}`)!.get('total_claimed')
  );

  assert.fieldEquals('RewardsDistributor', address2, 'id', address2);
  assert.fieldEquals('RewardsDistributor', address2, 'total_distributed', '200');
  assert.fieldEquals('RewardsDistributor', address2, 'created_at', now.toString());
  assert.fieldEquals('RewardsDistributor', address2, 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('RewardsDistributor', address2, 'updated_at', now.toString());
  assert.fieldEquals('RewardsDistributor', address2, 'updated_at_block', (now - 1000).toString());
  assert.fieldEquals('RewardsDistributor', address2, 'pool', '1');

  handleRewardsClaimed(rewardsClaimed);
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'id', `${address2}-${now}-1`);
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'created_at', now.toString());
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${now}-1`,
    'created_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'account', '1');
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'pool', '2');
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'collateral_type', address);
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'distributor', address2);
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'amount', '500');
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'updated_at', now.toString());
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${now}-1`,
    'updated_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'distributor', address2);
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'created_at',
    now.toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'created_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'updated_at',
    now.toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'updated_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'total_claimed',
    '500'
  );
  const rewardsClaimed2 = createRewardsClaimedEvent(
    1,
    2,
    address,
    address2,
    800,
    now + 1000,
    now,
    2
  );
  handleRewardsClaimed(rewardsClaimed2);
  assert.fieldEquals('RewardsDistributor', address2, 'total_distributed', '200');
  assert.fieldEquals('RewardsDistributor', address2, 'total_claimed', '1300');
  assert.fieldEquals('RewardsDistributor', address2, 'updated_at', (now + 1000).toString());
  assert.fieldEquals('RewardsDistributor', address2, 'updated_at_block', now.toString());
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${(now + 1000).toString()}-2`,
    'id',
    `${address2}-${(now + 1000).toString()}-2`
  );
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${(now + 1000).toString()}-2`,
    'created_at',
    (now + 1000).toString()
  );
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${(now + 1000).toString()}-2`,
    'created_at_block',
    now.toString()
  );
  assert.fieldEquals('RewardsClaimed', `${address2}-${(now + 1000).toString()}-2`, 'account', '1');
  assert.fieldEquals('RewardsClaimed', `${address2}-${(now + 1000).toString()}-2`, 'pool', '2');
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${(now + 1000).toString()}-2`,
    'collateral_type',
    address
  );
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${(now + 1000).toString()}-2`,
    'distributor',
    address2
  );
  assert.fieldEquals('RewardsClaimed', `${address2}-${(now + 1000).toString()}-2`, 'amount', '800');
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${(now + 1000).toString()}-2`,
    'updated_at',
    (now + 1000).toString()
  );
  assert.fieldEquals(
    'RewardsClaimed',
    `${address2}-${(now + 1000).toString()}-2`,
    'updated_at_block',
    now.toString()
  );
  assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'distributor', address2);
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'created_at',
    now.toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'created_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'updated_at',
    (now + 1000).toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'updated_at_block',
    now.toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `2-${address}-${address2}`,
    'total_claimed',
    '1300'
  );
}
