import { assert } from 'matchstick-as';
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
  assert.entityCount('MarketSnapshotByDay', 0);

  const sender = '0x6942000000000000000000000000000000000000';
  const marketId = 1;
  const target = '0x4200000000000000000000000000000000000000';
  const market = '0x6900000000000000000000000000000000000000';
  const blockNumber = 10;
  const logIndex = 1;

  const timestamp = 1640998800; // 2022-01-01T00:00:00.000Z;
  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour;

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
  assert.entityCount('MarketSnapshotByDay', 1);
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'usd_deposited', '200');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'usd_withdrawn', '0');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'net_issuance', '-200');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'created_at', `${timestamp}`);
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'updated_at', `${timestamp + oneHour}`);

  handleMarketUsdDeposited(
    createMarketUsdDepositedEvent(
      marketId,
      target,
      200,
      market,
      timestamp + oneDay + oneHour,
      blockNumber + 2,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.entityCount('MarketSnapshotByDay', 2);

  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'usd_deposited', '200');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'usd_withdrawn', '0');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'net_issuance', '-200');

  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_deposited', '400');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_withdrawn', '0');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'net_issuance', '-400');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'created_at', `${timestamp}`);
  assert.fieldEquals(
    'MarketSnapshotByDay',
    '1-2022-01-02',
    'updated_at',
    `${timestamp + oneDay + oneHour}`
  );

  handleMarketUsdWithdrawn(
    createMarketUsdWithdrawnEvent(
      marketId,
      target,
      300,
      market,
      timestamp + oneDay + oneHour,
      blockNumber + 2,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.entityCount('MarketSnapshotByDay', 2);

  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_deposited', '400');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_withdrawn', '300');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'net_issuance', '-100');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'created_at', `${timestamp}`);
  assert.fieldEquals(
    'MarketSnapshotByDay',
    '1-2022-01-02',
    'updated_at',
    `${timestamp + oneDay + oneHour}`
  );

  handleMarketUsdWithdrawn(
    createMarketUsdWithdrawnEvent(
      marketId,
      target,
      100,
      market,
      timestamp + oneDay + oneHour + oneHour,
      blockNumber + 3,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.entityCount('MarketSnapshotByDay', 2);

  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_deposited', '400');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_withdrawn', '400');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'net_issuance', '0');
  assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'created_at', `${timestamp}`);
  assert.fieldEquals(
    'MarketSnapshotByDay',
    '1-2022-01-02',
    'updated_at',
    `${timestamp + oneDay + oneHour + oneHour}`
  );
}
