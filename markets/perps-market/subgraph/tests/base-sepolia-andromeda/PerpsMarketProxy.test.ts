import { afterEach, beforeEach, clearStore, describe, logStore, test } from 'matchstick-as';

import handleSettlementStrategyAdded from './handleSettlementStrategyAdded';

describe('PerpsMarketProxy (base-sepolia-competition)', () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    logStore();
  });

  test('handleSettlementStrategyAdded', handleSettlementStrategyAdded);
});
