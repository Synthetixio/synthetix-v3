import { assert } from 'matchstick-as';
import {
  handleMarketCreated,
  handleMarketUsdDeposited,
  handleMarketUsdWithdrawn,
} from '../mainnet';
import {
  createMarketUsdWithdrawnEvent,
  createMarketRegisteredEvent,
  createMarketUsdDepositedEvent,
} from './event-factories';

export default function test(): void {
  assert.entityCount('Market', 0);
  assert.entityCount('MarketSnapshotByWeek', 0);

  const sender = '0x6942000000000000000000000000000000000000';
  const marketId = 1;
  const target = '0x4200000000000000000000000000000000000000';
  const market = '0x6900000000000000000000000000000000000000';
  const blockNumber = 10;
  const logIndex = 1;

  const timestamp = 1640998800; // 2022-01-01T00:00:00.000Z;
  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour;
  const oneWeek = oneDay * 7;

  handleMarketCreated(
    createMarketRegisteredEvent(market, marketId, sender, timestamp, blockNumber, logIndex)
  );

  handleMarketUsdDeposited(
    createMarketUsdDepositedEvent(
      marketId,
      target,
      200,
      market,
      timestamp + oneHour,
      blockNumber + 1,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.entityCount('MarketSnapshotByWeek', 1);

  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_deposited', '200');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_withdrawn', '0');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'net_issuance', '-200');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'created_at', `${timestamp}`);
  assert.fieldEquals(
    'MarketSnapshotByWeek',
    '1-week-2022-0',
    'updated_at',
    `${timestamp + oneHour}`
  );

  handleMarketUsdDeposited(
    createMarketUsdDepositedEvent(
      marketId,
      target,
      200,
      market,
      timestamp + oneHour + oneHour,
      blockNumber + 1,
      logIndex
    )
  );

  assert.entityCount('MarketSnapshotByWeek', 1);
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_deposited', '400');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_withdrawn', '0');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'net_issuance', '-400');
  assert.fieldEquals(
    'MarketSnapshotByWeek',
    '1-week-2022-0',
    'updated_at',
    `${timestamp + oneHour + oneHour}`
  );

  handleMarketUsdWithdrawn(
    createMarketUsdWithdrawnEvent(
      marketId,
      target,
      300,
      market,
      timestamp + oneWeek,
      blockNumber + 3,
      logIndex
    )
  );

  assert.entityCount('MarketSnapshotByWeek', 2);
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_deposited', '400');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_withdrawn', '0');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'net_issuance', '-400');
  assert.fieldEquals(
    'MarketSnapshotByWeek',
    '1-week-2022-0',
    'updated_at',
    `${timestamp + oneHour + oneHour}`
  );

  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-1', 'usd_deposited', '400');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-1', 'usd_withdrawn', '300');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-1', 'net_issuance', '-100');
  assert.fieldEquals(
    'MarketSnapshotByWeek',
    '1-week-2022-1',
    'updated_at',
    `${timestamp + oneWeek}`
  );

  handleMarketUsdWithdrawn(
    createMarketUsdWithdrawnEvent(
      marketId,
      target,
      100,
      market,
      timestamp + oneWeek + oneHour,
      blockNumber + 4,
      logIndex
    )
  );
  assert.entityCount('MarketSnapshotByWeek', 2);
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-1', 'usd_deposited', '400');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-1', 'usd_withdrawn', '400');
  assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-1', 'net_issuance', '0');
  assert.fieldEquals(
    'MarketSnapshotByWeek',
    '1-week-2022-1',
    'updated_at',
    `${timestamp + oneWeek + oneHour}`
  );
}
