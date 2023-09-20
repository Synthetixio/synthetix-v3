import { assert, log } from 'matchstick-as';

export default function test(): void {
  assert.entityCount('PositionLiquidated', 0);
  log.error('NOT IMPLEMENTED', []);
}
