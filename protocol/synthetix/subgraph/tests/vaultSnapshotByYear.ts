import { assert } from 'matchstick-as';
import { createDelegationUpdateEvent } from './event-factories';
import { handleDelegationUpdated } from '../mainnet';

export default function test(): void {
  assert.entityCount('Vault', 0);
  assert.entityCount('VaultSnapshotByYear', 0);

  const sender = '0x6942000000000000000000000000000000000000';

  const timestamp = 1640998800; // 2022-01-01T00:00:00.000Z;
  const now = new Date(timestamp).getTime();
  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour * 31 * 12;

  handleDelegationUpdated(createDelegationUpdateEvent(1, 1, sender, 100, 1, now, now - 1000));

  assert.entityCount('Vault', 1);
  assert.entityCount('VaultSnapshotByYear', 1);

  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'collateral_amount',
    '100'
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'created_at',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'created_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'updates_in_period',
    '1'
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'updated_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'updated_at',
    `${now}`
  );

  handleDelegationUpdated(createDelegationUpdateEvent(1, 1, sender, 200, 1, now + 1, now - 999));

  assert.entityCount('Vault', 1);
  assert.entityCount('VaultSnapshotByYear', 1);

  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'collateral_amount',
    '200'
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'created_at',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'created_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'updates_in_period',
    '2'
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'updated_at_block',
    `${now - 999}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2022',
    'updated_at',
    `${now + 1}`
  );

  handleDelegationUpdated(createDelegationUpdateEvent(1, 1, sender, 500, 1, now + oneDay, now));
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2023',
    'collateral_amount',
    '500'
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2023',
    'created_at',
    `${now + oneDay}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2023',
    'created_at_block',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2023',
    'updates_in_period',
    '1'
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2023',
    'updated_at_block',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByYear',
    '1-0x6942000000000000000000000000000000000000-2023',
    'updated_at',
    `${now + oneDay}`
  );
}
