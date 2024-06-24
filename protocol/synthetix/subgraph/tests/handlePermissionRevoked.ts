import { assert } from 'matchstick-as';
import { Address, ByteArray, Bytes } from '@graphprotocol/graph-ts';
import { address } from './constants';
import { handleAccountCreated, handlePermissionGranted, handlePermissionRevoked } from '../mainnet';
import {
  createAccountCreatedEvent,
  createPermissionGrantedEvent,
  createPermissionRevokedEvent,
} from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newAccountCreatedEvent = createAccountCreatedEvent(1, address, now, now - 1000);
  handleAccountCreated(newAccountCreatedEvent);
  const newPermissionGrantedEvent = createPermissionGrantedEvent(1, address, 1234, now + 1000, now);
  handlePermissionGranted(newPermissionGrantedEvent);
  const newPermissionGrantedEvent2 = createPermissionGrantedEvent(
    1,
    address,
    1111,
    now + 2000,
    now + 1000
  );
  handlePermissionGranted(newPermissionGrantedEvent2);
  const newPermissionRevokedEvent = createPermissionRevokedEvent(
    1,
    address,
    1234,
    now + 3000,
    now + 2000
  );
  handlePermissionRevoked(newPermissionRevokedEvent);
  assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'address', address);
  assert.fieldEquals('Account', '1', 'permissions', `[1-${address}]`);
  assert.fieldEquals(
    'AccountPermissionUsers',
    `1-${address}`,
    'created_at',
    (now + 1000).toString()
  );
  assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'created_at_block', now.toString());
  assert.fieldEquals(
    'AccountPermissionUsers',
    `1-${address}`,
    'updated_at',
    (now + 3000).toString()
  );
  assert.fieldEquals(
    'AccountPermissionUsers',
    `1-${address}`,
    'updated_at_block',
    (now + 2000).toString()
  );
  assert.fieldEquals('Account', '1', 'created_at', now.toString());
  assert.fieldEquals('Account', '1', 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('Account', '1', 'updated_at', (now + 3000).toString());
  assert.fieldEquals('Account', '1', 'updated_at_block', (now + 2000).toString());
  assert.notInStore(
    'AccountPermissionUsers',
    Bytes.fromByteArray(ByteArray.fromHexString(Address.fromString(address).toHex())).toString()
  );
}
