import { afterEach, beforeEach, clearStore, describe, logStore, test } from 'matchstick-as';

import handleAccountCreated from './handleAccountCreated';
import handleAccountLiquidated from './handleAccountLiquidated';
import handleCollateralModified from './handleCollateralModified';
import handleFundingParametersSet from './handleFundingParametersSet';
import handleLiquidationParametersSet from './handleLiquidationParametersSet';
import handleLockedOiRatioSet from './handleLockedOiRatioSet';
import handleMarketCreated from './handleMarketCreated';
import handleMarketPriceDataUpdated from './handleMarketPriceDataUpdated';
import handleMarketUpdated from './handleMarketUpdated';
import handleMaxLiquidationParametersSet from './handleMaxLiquidationParametersSet';
import handleOrderCommitted from './handleOrderCommitted';
import handleOrderFeesSet from './handleOrderFeesSet';
import handleOrderSettled from './handleOrderSettled';
import handlePositionLiquidated from './handlePositionLiquidated';
import handlePreviousOrderExpired from './handlePreviousOrderExpired';
import handleReferrerShareUpdated from './handleReferrerShareUpdated';
import handleSettlementStrategyAdded from './handleSettlementStrategyAdded';
import handleSettlementStrategyEnabled from './handleSettlementStrategyEnabled';

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
  test('handleFundingParametersSet', handleFundingParametersSet);
  test('handleLiquidationParametersSet', handleLiquidationParametersSet);
  test('handleLockedOiRatioSet', handleLockedOiRatioSet);
  test('handleMarketCreated', handleMarketCreated);
  test('handleMarketPriceDataUpdated', handleMarketPriceDataUpdated);
  test('handleMarketUpdated', handleMarketUpdated);
  test('handleMaxLiquidationParametersSet', handleMaxLiquidationParametersSet);
  test('handleOrderCommitted', handleOrderCommitted);
  test('handleOrderFeesSet', handleOrderFeesSet);
  test('handleOrderSettled', handleOrderSettled);
  test('handlePositionLiquidated', handlePositionLiquidated);
  test('handlePreviousOrderExpired', handlePreviousOrderExpired);
  test('handleReferrerShareUpdated', handleReferrerShareUpdated);
  test('handleSettlementStrategyAdded', handleSettlementStrategyAdded);
  test('handleSettlementStrategyEnabled', handleSettlementStrategyEnabled);
});
