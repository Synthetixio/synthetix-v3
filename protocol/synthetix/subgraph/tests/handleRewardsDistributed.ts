import { assert } from 'matchstick-as';
import { Address, BigInt, store } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import {
  handleRewardsDistributed,
  handleRewardsDistributorRegistered,
  handlePoolCreated,
} from '../mainnet';
import {
  createRewardsDistributedEvent,
  createRewardsDistributorRegisteredEvent,
  createPoolCreatedEvent,
} from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
  handlePoolCreated(newPoolEvent);

  const rewardsDistributedEvent = createRewardsDistributedEvent(
    BigInt.fromI32(1),
    Address.fromString(address),
    Address.fromString(address2),
    BigInt.fromI32(200),
    BigInt.fromI64(now),
    BigInt.fromI32(300),
    now,
    now - 1000
  );
  const rewardsDistributorRegisteredEvent = createRewardsDistributorRegisteredEvent(
    BigInt.fromI32(1),
    Address.fromString(address),
    Address.fromString(address2),
    now,
    now - 1000
  );
  handleRewardsDistributorRegistered(rewardsDistributorRegisteredEvent);
  handleRewardsDistributed(rewardsDistributedEvent);
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${now.toString()}-1`,
    'id',
    `${address2}-${now.toString()}-1`
  );
  assert.fieldEquals('RewardsDistribution', `${address2}-${now.toString()}-1`, 'amount', '200');
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${now.toString()}-1`,
    'collateral_type',
    address
  );
  assert.fieldEquals('RewardsDistribution', `${address2}-${now.toString()}-1`, 'pool', '1');
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${now.toString()}-1`,
    'start',
    now.toString()
  );
  assert.fieldEquals('RewardsDistribution', `${address2}-${now.toString()}-1`, 'duration', '300');
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${now.toString()}-1`,
    'created_at',
    now.toString()
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${now.toString()}-1`,
    'created_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${now.toString()}-1`,
    'updated_at',
    now.toString()
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${now.toString()}-1`,
    'updated_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals('RewardsDistribution', `${address2}-${now.toString()}-1`, 'pool', '1');
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'id',
    `1-${address}-${address2}`
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'created_at',
    now.toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'created_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'updated_at',
    now.toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'updated_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'distributor',
    address2
  );

  assert.fieldEquals('RewardsDistributor', address2, 'id', address2);
  assert.fieldEquals('RewardsDistributor', address2, 'total_distributed', '200');
  assert.fieldEquals('RewardsDistributor', address2, 'created_at', now.toString());
  assert.fieldEquals('RewardsDistributor', address2, 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('RewardsDistributor', address2, 'updated_at', now.toString());
  assert.fieldEquals('RewardsDistributor', address2, 'updated_at_block', (now - 1000).toString());
  assert.fieldEquals('RewardsDistributor', address2, 'pool', '1');

  assert.assertNull(
    store.get('AccountRewardsDistributor', `1-${address}-${address2}`)!.get('total_claimed')
  );
  const rewardsDistributedEvent2 = createRewardsDistributedEvent(
    BigInt.fromI32(1),
    Address.fromString(address),
    Address.fromString(address2),
    BigInt.fromI32(500),
    BigInt.fromI64(now + 1000),
    BigInt.fromI32(1000),
    now + 1000,
    now,
    2
  );
  handleRewardsDistributed(rewardsDistributedEvent2);
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'id',
    `${address2}-${(now + 1000).toString()}-2`
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'amount',
    '500'
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'collateral_type',
    address
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'pool',
    '1'
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'start',
    (now + 1000).toString()
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'duration',
    '1000'
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'created_at',
    (now + 1000).toString()
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'created_at_block',
    (now + 1000 - 1000).toString()
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'updated_at',
    (now + 1000).toString()
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'updated_at_block',
    (now + 1000 - 1000).toString()
  );
  assert.fieldEquals(
    'RewardsDistribution',
    `${address2}-${(now + 1000).toString()}-2`,
    'pool',
    '1'
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'id',
    `1-${address}-${address2}`
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'created_at',
    now.toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'created_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'updated_at',
    (now + 1000).toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'updated_at_block',
    now.toString()
  );
  assert.fieldEquals(
    'AccountRewardsDistributor',
    `1-${address}-${address2}`,
    'distributor',
    address2
  );
  assert.assertNull(
    store.get('AccountRewardsDistributor', `1-${address}-${address2}`)!.get('total_claimed')
  );
  assert.fieldEquals('RewardsDistributor', address2, 'total_distributed', '700');
  assert.fieldEquals('RewardsDistributor', address2, 'updated_at', (now + 1000).toString());
  assert.fieldEquals('RewardsDistributor', address2, 'updated_at_block', now.toString());
}
