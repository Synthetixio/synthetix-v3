import { assert } from 'matchstick-as';
import { store } from '@graphprotocol/graph-ts';
import { address } from './constants';
import { handlePoolCreated, handlePoolNameUpdated } from '../mainnet';
import { createPoolCreatedEvent, createPoolNameUpdatedEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
  const newPoolNameEvent = createPoolNameUpdatedEvent(1, 'SC Pool', now + 1000, now);
  handlePoolCreated(newPoolEvent);
  handlePoolNameUpdated(newPoolNameEvent);
  assert.fieldEquals('Pool', '1', 'id', '1');
  assert.fieldEquals('Pool', '1', 'name', 'SC Pool');
  assert.fieldEquals('Pool', '1', 'created_at', now.toString());
  assert.fieldEquals('Pool', '1', 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('Pool', '1', 'updated_at', (now + 1000).toString());
  assert.fieldEquals('Pool', '1', 'updated_at_block', now.toString());
  assert.assertNull(store.get('Pool', '1')!.get('nominated_owner'));
  assert.assertNull(store.get('Pool', '1')!.get('total_weight'));
  assert.notInStore('Pool', '2');
}
