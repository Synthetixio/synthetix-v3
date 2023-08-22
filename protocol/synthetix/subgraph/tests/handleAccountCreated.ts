import { assert } from 'matchstick-as';
import { address } from './constants';
import { handleAccountCreated } from '../mainnet';
import { createAccountCreatedEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const accountCreatedEvent = createAccountCreatedEvent(1, address, now, now - 1000);
  handleAccountCreated(accountCreatedEvent);
  assert.fieldEquals('Account', '1', 'id', '1');
  assert.fieldEquals('Account', '1', 'owner', address);
  assert.fieldEquals('Account', '1', 'created_at', now.toString());
  assert.fieldEquals('Account', '1', 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('Account', '1', 'updated_at', now.toString());
  assert.fieldEquals('Account', '1', 'updated_at_block', (now - 1000).toString());
  assert.fieldEquals('Account', '1', 'permissions', '[]');
  assert.notInStore('Account', '2');
}
