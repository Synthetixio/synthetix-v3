import { assert, log } from 'matchstick-as';

export default function test(): void {
  assert.entityCount('Market', 0);
  assert.entityCount('MarketUpdated', 0);
  log.error('NOT IMPLEMENTED', []);
}
