import { log, assert } from 'matchstick-as';
import { handleMarketCreated, handleMarketUsdDeposited } from '../mainnet';
import { getMarketReportedDebtMock } from './mocks/getMarketReportedDebtMock';
import { createMarketRegisteredEvent } from './event-factories/createMarketRegisteredEvent';
import { createMarketUsdDepositedEvent } from './event-factories/createMarketUsdDepositedEvent';

export default function test(): void {
  assert.entityCount('Market', 0);

  const sender = '0x6942000000000000000000000000000000000000';
  const marketId = 1;
  const target = '0x4200000000000000000000000000000000000000';
  const amount = 200;
  const market = '0x6900000000000000000000000000000000000000';
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;
  const reportedDebt = 42;

  getMarketReportedDebtMock(marketId, reportedDebt);

  handleMarketCreated(
    createMarketRegisteredEvent(market, marketId, sender, timestamp, blockNumber, logIndex)
  );

  log.info('Should update Market record after first deposit of 200 happened', []);

  handleMarketUsdDeposited(
    createMarketUsdDepositedEvent(
      marketId,
      target,
      amount,
      market,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);

  assert.fieldEquals('Market', '1', 'reported_debt', `${reportedDebt}`);
  assert.fieldEquals('Market', '1', 'usd_deposited', '200');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
  assert.fieldEquals('Market', '1', 'net_issuance', '-200');
  assert.fieldEquals('Market', '1', 'updated_at_block', `${blockNumber}`);
  assert.fieldEquals('Market', '1', 'updated_at', `${timestamp}`);

  log.info('Should update Market record after second deposit of 300 happened', []);

  handleMarketUsdDeposited(
    createMarketUsdDepositedEvent(marketId, target, 300, market, timestamp, blockNumber, logIndex)
  );

  assert.entityCount('Market', 1);

  assert.fieldEquals('Market', '1', 'reported_debt', `${reportedDebt}`);
  assert.fieldEquals('Market', '1', 'usd_deposited', '500');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
  assert.fieldEquals('Market', '1', 'net_issuance', '-500');
  assert.fieldEquals('Market', '1', 'updated_at_block', `${blockNumber}`);
  assert.fieldEquals('Market', '1', 'updated_at', `${timestamp}`);
}
