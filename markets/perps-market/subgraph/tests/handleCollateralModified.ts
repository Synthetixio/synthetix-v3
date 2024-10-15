import { assert, log } from 'matchstick-as';
import { handleCollateralModified } from '../base-mainnet-andromeda';
import { createCollateralModifiedEvent } from './event-factories/createCollateralModifiedEvent';

export default function test(): void {
  assert.entityCount('CollateralModified', 0);

  log.info('Should create a new record when collateral modified', []);
  const sender1 = '0x4200000000000000000000000000000000000000';
  handleCollateralModified(createCollateralModifiedEvent(1, 69, 100, sender1, 10_000, 10, 1));
  assert.entityCount('CollateralModified', 1);
  assert.fieldEquals('CollateralModified', '1-10-1', 'accountId', '1');
  assert.fieldEquals('CollateralModified', '1-10-1', 'timestamp', '10000');
  assert.fieldEquals('CollateralModified', '1-10-1', 'amount', '100');
  assert.fieldEquals('CollateralModified', '1-10-1', 'sender', sender1);
  assert.fieldEquals('CollateralModified', '1-10-1', 'synthMarketId', '69');

  log.info('Should create another record when collateral modified with negative amount', []);
  const sender2 = '0x6900000000000000000000000000000000000000';
  handleCollateralModified(createCollateralModifiedEvent(1, 69, -200, sender2, 10_000, 11, 2));
  assert.entityCount('CollateralModified', 2);
  assert.fieldEquals('CollateralModified', '1-11-2', 'accountId', '1');
  assert.fieldEquals('CollateralModified', '1-11-2', 'timestamp', '10000');
  assert.fieldEquals('CollateralModified', '1-11-2', 'amount', '-200');
  assert.fieldEquals('CollateralModified', '1-11-2', 'sender', sender2);
  assert.fieldEquals('CollateralModified', '1-11-2', 'synthMarketId', '69');
}
