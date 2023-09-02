import { assert, log } from 'matchstick-as';

export default function test(): void {
  assert.entityCount('PreviousOrderExpired', 0);
  log.error('NOT IMPLEMENTED', []);
}
