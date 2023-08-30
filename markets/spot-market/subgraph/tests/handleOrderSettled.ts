import { assert } from 'matchstick-as';

export default function test(): void {
  assert.entityCount('Order', 0);
}
