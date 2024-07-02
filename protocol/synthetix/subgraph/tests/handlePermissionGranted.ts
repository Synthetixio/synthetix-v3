import { assert } from 'matchstick-as';
import { Bytes } from '@graphprotocol/graph-ts';
import { address } from './constants';
import { handleAccountCreated, handlePermissionGranted } from '../mainnet';
import { createAccountCreatedEvent, createPermissionGrantedEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newAccountCreatedEvent = createAccountCreatedEvent(1, address, now, now - 1000);
  const newPermissionGrantedEvent = createPermissionGrantedEvent(1, address, 1234, now + 1000, now);
  handleAccountCreated(newAccountCreatedEvent);
  handlePermissionGranted(newPermissionGrantedEvent);
  assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'id', `1-${address}`);
  assert.fieldEquals(
    'AccountPermissionUsers',
    `1-${address}`,
    'permissions',
    `[${Bytes.fromByteArray(Bytes.fromI64(1234)).toHex()}]`
  );
  assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'address', address);
  assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'account', '1');
  assert.fieldEquals(
    'AccountPermissionUsers',
    `1-${address}`,
    'created_at',
    (now + 1000).toString()
  );
  assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'created_at_block', now.toString());
  assert.fieldEquals('Account', '1', 'permissions', `[1-${address}]`);
  assert.fieldEquals('Account', '1', 'created_at', now.toString());
  assert.fieldEquals('Account', '1', 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('Account', '1', 'updated_at_block', now.toString());
  assert.fieldEquals('Account', '1', 'updated_at', (now + 1000).toString());
  assert.fieldEquals('Account', '1', 'permissions', `[1-${address}]`);
  const newPermissionGrantedEvent2 = createPermissionGrantedEvent(
    1,
    address,
    4321,
    now + 2000,
    now + 1000
  );
  handlePermissionGranted(newPermissionGrantedEvent2);
  assert.fieldEquals(
    'AccountPermissionUsers',
    `1-${address}`,
    'permissions',
    `[${Bytes.fromByteArray(Bytes.fromI64(1234)).toHex()}, ${Bytes.fromByteArray(
      Bytes.fromI64(4321)
    ).toHex()}]`
  );
  assert.fieldEquals('Account', '1', 'updated_at_block', (now + 1000).toString());
  assert.fieldEquals('Account', '1', 'updated_at', (now + 2000).toString());
  assert.fieldEquals(
    'AccountPermissionUsers',
    `1-${address}`,
    'updated_at_block',
    (now + 1000).toString()
  );
  assert.fieldEquals(
    'AccountPermissionUsers',
    `1-${address}`,
    'updated_at',
    (now + 2000).toString()
  );
  assert.fieldEquals('Account', '1', 'permissions', `[1-${address}]`);
}
