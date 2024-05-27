import { assert } from 'matchstick-as';
import { createDelegationUpdateEvent } from './event-factories';
import { Address, BigInt } from '@graphprotocol/graph-ts';
import { handleDelegationUpdated } from '../mainnet';

export default function test(): void {
  assert.entityCount('Vault', 0);
  assert.entityCount('VaultSnapshotByDay', 0);

  const sender = '0x6942000000000000000000000000000000000000';

  const timestamp = 1640998800; // 2022-01-01T00:00:00.000Z;
  const now = new Date(timestamp).getTime();
  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour;

  handleDelegationUpdated(
    createDelegationUpdateEvent(
      BigInt.fromI32(1),
      BigInt.fromI32(1),
      Address.fromString(sender),
      BigInt.fromI32(100),
      BigInt.fromI32(1),
      now,
      now - 1000
    )
  );

  assert.entityCount('Vault', 1);
  assert.entityCount('VaultSnapshotByDay', 1);

  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'collateral_amount',
    '100'
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'created_at',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'created_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'updates_in_period',
    '1'
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'updated_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'updated_at',
    `${now}`
  );

  handleDelegationUpdated(
    createDelegationUpdateEvent(
      BigInt.fromI32(1),
      BigInt.fromI32(1),
      Address.fromString(sender),
      BigInt.fromI32(-50),
      BigInt.fromI32(1),
      now + 1,
      now - 999
    )
  );

  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'collateral_amount',
    '50'
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'created_at',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'created_at_block',
    `${now - 1000}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'updates_in_period',
    '2'
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'updated_at_block',
    `${now - 999}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-01',
    'updated_at',
    `${now + 1}`
  );

  handleDelegationUpdated(
    createDelegationUpdateEvent(
      BigInt.fromI32(2),
      BigInt.fromI32(1),
      Address.fromString(sender),
      BigInt.fromI32(500),
      BigInt.fromI32(1),
      now + oneDay,
      now
    )
  );

  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-02',
    'collateral_amount',
    '550'
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-02',
    'created_at',
    `${now + oneDay}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-02',
    'created_at_block',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-02',
    'updates_in_period',
    '1'
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-02',
    'updated_at_block',
    `${now}`
  );
  assert.fieldEquals(
    'VaultSnapshotByDay',
    '1-0x6942000000000000000000000000000000000000-2022-01-02',
    'updated_at',
    `${now + oneDay}`
  );
}
