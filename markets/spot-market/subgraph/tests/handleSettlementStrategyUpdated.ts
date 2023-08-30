import { assert } from 'matchstick-as';

export default function test(): void {
  assert.entityCount('SettlementStrategy', 0);
}
