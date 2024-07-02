import { assert } from 'matchstick-as';
import { store } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import {
  handleRewardsDistributed,
  handleRewardsDistributorRegistered,
  handlePoolCreated,
  handleRewardsDistributorRemoved,
} from '../mainnet';
import {
  createRewardsDistributedEvent,
  createRewardsDistributorRegisteredEvent,
  createPoolCreatedEvent,
  createRewardsDistributorRemovedEvent,
} from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
  handlePoolCreated(newPoolEvent);

  const rewardsDistributedEvent = createRewardsDistributedEvent(
    1,
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
  assert.fieldEquals('RewardsDistributor', address2, 'isActive', 'true');

  assert.assertNull(
    store.get('AccountRewardsDistributor', `1-${address}-${address2}`)!.get('total_claimed')
  );
  const rewardsDistributedEvent2 = createRewardsDistributedEvent(
    1,
    address,
    address2,
    500,
    now + 1000,
    1000,
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

  const rewardsDistributedEvent3 = createRewardsDistributorRemovedEvent(
    1,
    address,
    address2,
    now + 1000,
    now
  );

  handleRewardsDistributorRemoved(rewardsDistributedEvent3);
  assert.fieldEquals('RewardsDistributor', address2, 'isActive', 'false');

  const snxDistributor = '0x45063dcd92f56138686810eacb1b510c941d6593';
  const pdao = '0xbb63ca5554dc4ccaca4edd6ecc2837d5efe83c82';

  // Pdao situation
  const rewardsDistributedFromPdaoEvent = createRewardsDistributedEvent(
    1,
    address,
    pdao,
    200,
    1716127200,
    300,
    1716127200,
    1716127200 - 1000
  );

  const rewardsSnxDistributorRegisteredEvent = createRewardsDistributorRegisteredEvent(
    1,
    address,
    snxDistributor,
    1716127200,
    1716127200 - 1000
  );

  handleRewardsDistributorRegistered(rewardsSnxDistributorRegisteredEvent);
  handleRewardsDistributed(rewardsDistributedFromPdaoEvent);

  assert.fieldEquals('RewardsDistributor', snxDistributor, 'isActive', 'true');
  assert.fieldEquals('RewardsDistribution', `${pdao}-1716127200-1`, 'duration', '300');
  assert.fieldEquals('RewardsDistribution', `${pdao}-1716127200-1`, 'start', '1716127200');
  assert.fieldEquals('RewardsDistribution', `${pdao}-1716127200-1`, 'distributor', snxDistributor);
}
