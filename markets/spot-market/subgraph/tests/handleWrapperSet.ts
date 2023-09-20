import { assert, log } from 'matchstick-as';
import { handleWrapperSet } from '../optimism-mainnet';
import { createWrapperSetEvent } from './event-factories/createWrapperSetEvent';

export default function test(): void {
  assert.entityCount('Wrapper', 0);

  log.info('Should create a new record for the market', []);
  const collateral1 = '0x4200000000000000000000000000000000000000';
  handleWrapperSet(createWrapperSetEvent(69, collateral1, 100500, 10_000, 10));
  assert.entityCount('Wrapper', 1);
  assert.fieldEquals('Wrapper', '69', 'marketId', '69');
  assert.fieldEquals('Wrapper', '69', 'wrapCollateralType', collateral1);
  assert.fieldEquals('Wrapper', '69', 'maxWrappableAmount', '100500');

  log.info('Should update existing market', []);
  const collateral2 = '0x6900000000000000000000000000000000000000';
  handleWrapperSet(createWrapperSetEvent(69, collateral2, 9999, 20_000, 20));
  assert.entityCount('Wrapper', 1);
  assert.fieldEquals('Wrapper', '69', 'marketId', '69');
  assert.fieldEquals('Wrapper', '69', 'wrapCollateralType', collateral2);
  assert.fieldEquals('Wrapper', '69', 'maxWrappableAmount', '9999');
}
