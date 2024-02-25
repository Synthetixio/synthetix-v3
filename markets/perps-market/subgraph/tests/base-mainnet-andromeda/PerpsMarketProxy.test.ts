import { afterEach, beforeEach, clearStore, describe, logStore, test } from 'matchstick-as';

import handleSettlementStrategyAdded from './handleSettlementStrategyAdded';

describe('PerpsMarketProxy (base-mainnet-competition)', () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    logStore();
  });

  test('handleSettlementStrategyAdded', handleSettlementStrategyAdded);
});
