import { afterEach, beforeEach, clearStore, describe, logStore, test } from 'matchstick-as';

import handleAccountCreated from './handleAccountCreated';
import handleAccountLiquidated from './handleAccountLiquidated';
import handleCollateralModified from './handleCollateralModified';

describe('PerpsMarketProxy', () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    logStore();
  });

  test('handleAccountCreated', handleAccountCreated);
  test('handleAccountLiquidated', handleAccountLiquidated);
  test('handleCollateralModified', handleCollateralModified);
});
