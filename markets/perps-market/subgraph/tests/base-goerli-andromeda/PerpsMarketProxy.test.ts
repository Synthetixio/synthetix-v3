import { afterEach, beforeEach, clearStore, describe, logStore, test } from 'matchstick-as';

import handleSettlementStrategyAdded from './handleSettlementStrategyAdded';

describe('PerpsMarketProxy (base-goerli-competition)', () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    logStore();
  });

  test('handleSettlementStrategyAdded', handleSettlementStrategyAdded);
});
