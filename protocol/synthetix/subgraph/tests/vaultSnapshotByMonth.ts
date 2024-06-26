import { assert } from 'matchstick-as';
import { createDelegationUpdateEvent } from './event-factories';
import { handleDelegationUpdated } from '../mainnet';

export default function test(): void {
  assert.entityCount('Vault', 0);
  assert.entityCount('VaultSnapshotByMonth', 0);

  const sender = '0x6942000000000000000000000000000000000000';

  const timestamp = 1640998800; // 2022-01-01T00:00:00.000Z;
  const now = new Date(timestamp).getTime();
  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour * 32;

  handleDelegationUpdated(createDelegationUpdateEvent(1, 1, sender, 100, 1, now, now - 1000));

  assert.entityCount('Vault', 1);
  assert.entityCount('VaultSnapshotByMonth', 1);

  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'collateral_amount',
    '100'
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'created_at',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'created_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'updates_in_period',
    '1'
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'updated_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'updated_at',
    `${now}`
  );

  handleDelegationUpdated(createDelegationUpdateEvent(1, 1, sender, 0, 1, now + 1, now - 999));

  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'collateral_amount',
    '0'
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'created_at',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'created_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'updates_in_period',
    '2'
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'updated_at_block',
    `${now - 999}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-0',
    'updated_at',
    `${now + 1}`
  );

  handleDelegationUpdated(createDelegationUpdateEvent(2, 1, sender, 500, 1, now + oneDay, now));
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-1',
    'collateral_amount',
    '500'
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-1',
    'created_at',
    `${now + oneDay}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-1',
    'created_at_block',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-1',
    'updates_in_period',
    '1'
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-1',
    'updated_at_block',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByMonth',
    '1-0x6942000000000000000000000000000000000000-2022-1',
    'updated_at',
    `${now + oneDay}`
  );
}
