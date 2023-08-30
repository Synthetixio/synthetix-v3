import { assert, log } from 'matchstick-as';

export default function test(): void {
  assert.entityCount('Order', 0);
  log.error('NOT IMPLEMENTED', []);
}
