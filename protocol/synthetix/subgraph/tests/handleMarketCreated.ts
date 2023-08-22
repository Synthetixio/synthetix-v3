import { assert } from 'matchstick-as';
import { address } from './constants';
import { handleMarketCreated } from '../src';
import { createMarketCreatedEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = 10_000;
  const newMarketRegisteredEvent = createMarketCreatedEvent(1, address, now, now - 1000);
  handleMarketCreated(newMarketRegisteredEvent);
  assert.fieldEquals('Market', '1', 'id', '1');
  assert.fieldEquals('Market', '1', 'address', address);
  assert.fieldEquals('Market', '1', 'created_at', '10000');
  assert.fieldEquals('Market', '1', 'created_at_block', '9000');
  assert.fieldEquals('Market', '1', 'updated_at', '10000');
  assert.fieldEquals('Market', '1', 'updated_at_block', '9000');
  assert.fieldEquals('Market', '1', 'usd_deposited', '0');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
  assert.fieldEquals('Market', '1', 'net_issuance', '0');
  assert.fieldEquals('Market', '1', 'reported_debt', '0');
  assert.notInStore('Market', '2');
}
