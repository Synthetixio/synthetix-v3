import { afterEach, beforeEach, clearStore, describe, logStore, test } from 'matchstick-as';

import handleOrderCancelled from './handleOrderCancelled';
import handleOrderCommitted from './handleOrderCommitted';
import handleOrderSettled from './handleOrderSettled';
import handleSettlementStrategyAdded from './handleSettlementStrategyAdded';
import handleSettlementStrategySet from './handleSettlementStrategySet';
import handleSynthPriceDataUpdated from './handleSynthPriceDataUpdated';
import handleSynthUnwrapped from './handleSynthUnwrapped';
import handleSynthWrapped from './handleSynthWrapped';
import handleWrapperSet from './handleWrapperSet';

describe('SpotMarketProxy', () => {
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
  test('handleSettlementStrategySet', handleSettlementStrategySet);
  test('handleSynthPriceDataUpdated', handleSynthPriceDataUpdated);
  test('handleSynthUnwrapped', handleSynthUnwrapped);
  test('handleSynthWrapped', handleSynthWrapped);
  test('handleWrapperSet', handleWrapperSet);
});
