import { assert, log } from 'matchstick-as';
import {
  handleMarketCreated,
  handleMarketUsdDeposited,
  handleMarketUsdWithdrawn,
} from '../mainnet';
import {
  createMarketUsdDepositedEvent,
  createMarketUsdWithdrawnEvent,
  createMarketRegisteredEvent,
} from './event-factories';

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

  handleMarketCreated(
    createMarketRegisteredEvent(market, marketId, sender, timestamp, blockNumber, logIndex)
  );

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

  log.info('Should update Market record after withdrawal of 300', []);

  handleMarketUsdWithdrawn(
    createMarketUsdWithdrawnEvent(
      marketId,
      target,
      300,
      market,
      timestamp + 1_000,
      blockNumber + 1,
      logIndex
    )
  );

  assert.entityCount('Market', 1);

  assert.fieldEquals('Market', '1', 'address', market);
  assert.fieldEquals('Market', '1', 'created_at', `${timestamp}`);
  assert.fieldEquals('Market', '1', 'created_at_block', `${blockNumber}`);
  assert.fieldEquals('Market', '1', 'updated_at', `${timestamp + 1_000}`);
  assert.fieldEquals('Market', '1', 'updated_at_block', `${blockNumber + 1}`);

  assert.fieldEquals('Market', '1', 'usd_deposited', '400');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '300');
  assert.fieldEquals('Market', '1', 'net_issuance', '-100');

  log.info('Should update Market record after another withdrawal of 100', []);

  handleMarketUsdWithdrawn(
    createMarketUsdWithdrawnEvent(
      marketId,
      target,
      100,
      market,
      timestamp + 1_000,
      blockNumber + 1,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.fieldEquals('Market', '1', 'usd_deposited', '400');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '400');
  assert.fieldEquals('Market', '1', 'net_issuance', '0');
}
