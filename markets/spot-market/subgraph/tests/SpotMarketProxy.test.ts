import { afterEach, beforeEach, clearStore, describe, logStore, test } from 'matchstick-as';

import handleOrderCancelled from './handleOrderCancelled';
import handleOrderCommitted from './handleOrderCommitted';
import handleOrderSettled from './handleOrderSettled';
import handleSettlementStrategyAdded from './handleSettlementStrategyAdded';
import handleSettlementStrategyUpdated from './handleSettlementStrategyUpdated';
import handleSynthPriceDataUpdated from './handleSynthPriceDataUpdated';
import handleSynthUnwrapped from './handleSynthUnwrapped';
import handleSynthWrapped from './handleSynthWrapped';
import handleWrapperSet from './handleWrapperSet';

describe('PerpsMarketProxy', () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    logStore();
  });

  test('handleOrderCancelled', handleOrderCancelled);
  test('handleOrderCommitted', handleOrderCommitted);
  test('handleOrderSettled', handleOrderSettled);
  test('handleSettlementStrategyAdded', handleSettlementStrategyAdded);
  test('handleSettlementStrategyUpdated', handleSettlementStrategyUpdated);
  test('handleSynthPriceDataUpdated', handleSynthPriceDataUpdated);
  test('handleSynthUnwrapped', handleSynthUnwrapped);
  test('handleSynthWrapped', handleSynthWrapped);
  test('handleWrapperSet', handleWrapperSet);
});
