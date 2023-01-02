import {
  test,
  assert,
  clearStore,
  describe,
  beforeEach,
  createMockedFunction,
} from 'matchstick-as';
import { Address, ethereum, BigInt } from '@graphprotocol/graph-ts';
import { address, address2, defaultGraphContractAddress } from './constants';
import {
  handleMarketUsdWithdrawn,
  handleMarketCreated,
  handleMarketUsdDeposited,
} from '../src/market';
import {
  createMarketCreatedEvent,
  createMarketUsdDepositedEvent,
  createMarketUsdWithdrawnEvent,
} from './event-factories';
describe('MarketSnapshotByDay', () => {
  beforeEach(() => {
    clearStore();
  });
  test('Handles deposit and withdrawals', () => {
    // @ts-ignore
    const now = <i64>Date.parse('2022-01-01T00:00:00.000Z').getTime();
    // @ts-ignore
    const oneHour = <i64>60 * 60 * 1000; // Number of milliseconds in one hour
    // @ts-ignore
    const oneDay = <i64>24 * oneHour; // Number of milliseconds in one day
    const newMarketRegisteredEvent = createMarketCreatedEvent(1, address, now, now - 1);
    const arg = ethereum.Value.fromUnsignedBigInt(BigInt.fromU64(1));
    createMockedFunction(
      Address.fromString(defaultGraphContractAddress),
      'getMarketReportedDebt',
      'getMarketReportedDebt(uint128):(uint256)'
    )
      .withArgs([arg])
      .returns([ethereum.Value.fromI32(23)]);
    const newUsdDepositedEvent = createMarketUsdDepositedEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(200),
      now,
      now - 1
    );
    const newUsdDepositedEventOneHourLater = createMarketUsdDepositedEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(200),
      now + oneHour,
      now + oneHour - 1
    );
    const newUsdWithdrawnEventNextDay = createMarketUsdWithdrawnEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(300),
      now + oneDay + oneHour,
      now + oneDay + oneHour - 1
    );
    const newUsdWithdrawnEventNextDay1 = createMarketUsdWithdrawnEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(100),
      now + oneDay + oneHour + oneHour,
      now + oneDay + oneHour + oneHour - 1
    );
    // Trigger market creation and a deposit event
    // We trigger this on the main handler since we expect that to call createMarketSnapshotByDay
    handleMarketCreated(newMarketRegisteredEvent);
    handleMarketUsdDeposited(newUsdDepositedEvent);
    // Assert Market snapshot is created for the deposit event
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'reported_debt', '23');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'usd_deposited', '200');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'usd_withdrawn', '0');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'net_issuance', '-200');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'created_at', now.toString());
    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-01',
      'created_at_block',
      (now - 1).toString()
    );
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'updated_at', now.toString());
    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-01',
      'updated_at_block',
      (now - 1).toString()
    );
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'market', '1');

    // Trigger another deposit in the same day
    handleMarketUsdDeposited(newUsdDepositedEventOneHourLater);

    // Assert Market snapshot can handle deposits on the same day
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'reported_debt', '23');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'usd_deposited', '400');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'usd_withdrawn', '0');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'net_issuance', '-400');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'created_at', now.toString());
    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-01',
      'created_at_block',
      (now - 1).toString()
    );

    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-01',
      'updated_at',
      (now + oneHour).toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-01',
      'updated_at_block',
      (now + oneHour - 1).toString()
    );
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-01', 'market', '1');

    // Trigger a withdrawal event
    handleMarketUsdWithdrawn(newUsdWithdrawnEventNextDay);

    // Assert Market snapshot is created for the withdrawal event
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'reported_debt', '23');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_deposited', '400');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_withdrawn', '300');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'net_issuance', '-100');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'created_at', now.toString());
    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-02',
      'created_at_block',
      (now - 1).toString()
    );

    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-02',
      'updated_at',
      (now + oneDay + oneHour).toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-02',
      'updated_at_block',
      (now + oneDay + oneHour - 1).toString()
    );
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'market', '1');

    // Trigger another withdrawal in the same day
    handleMarketUsdWithdrawn(newUsdWithdrawnEventNextDay1);

    // Assert Market snapshot can handle withdrawal on the same day
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'reported_debt', '23');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_deposited', '400');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'usd_withdrawn', '400');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'net_issuance', '0');
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'created_at', now.toString());
    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-02',
      'created_at_block',
      (now - 1).toString()
    );

    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-02',
      'updated_at',
      (now + oneDay + oneHour + oneHour).toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByDay',
      '1-2022-01-02',
      'updated_at_block',
      (now + oneDay + oneHour + oneHour - 1).toString()
    );
    assert.fieldEquals('MarketSnapshotByDay', '1-2022-01-02', 'market', '1');
  });
});
