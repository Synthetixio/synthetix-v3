import { assert } from 'matchstick-as';
import { store } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import {
  handlePoolCreated,
  handlePoolNominationRenounced,
  handlePoolOwnerNominated,
} from '../mainnet';
import {
  createPoolCreatedEvent,
  createPoolOwnerNominatedEvent,
  createPoolOwnershipRenouncedEvent,
} from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newPool = createPoolCreatedEvent(1, address, now, now - 1000);
  const newNominatedPoolOwnerEvent = createPoolOwnerNominatedEvent(
    1,
    address2,
    address,
    now + 1000,
    now
  );
  const newPoolOwnershipRenouncedEvent = createPoolOwnershipRenouncedEvent(1, now + 1000, now);
  handlePoolCreated(newPool);
  handlePoolOwnerNominated(newNominatedPoolOwnerEvent);
  handlePoolNominationRenounced(newPoolOwnershipRenouncedEvent);
  assert.fieldEquals('Pool', '1', 'id', '1');
  assert.fieldEquals('Pool', '1', 'owner', address);
  assert.fieldEquals('Pool', '1', 'nominated_owner', '0x00000000');
  assert.fieldEquals('Pool', '1', 'created_at', now.toString());
  assert.fieldEquals('Pool', '1', 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('Pool', '1', 'updated_at', (now + 1000).toString());
  assert.fieldEquals('Pool', '1', 'updated_at_block', now.toString());
  assert.assertNull(store.get('Pool', '1')!.get('name'));
  assert.assertNull(store.get('Pool', '1')!.get('total_weight'));
  assert.notInStore('Pool', '2');
}
