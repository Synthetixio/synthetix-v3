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
import { getISOWeekNumber } from '../src/marketSnapshotByWeek';
describe('MarketSnapshotByWeek', () => {
  beforeEach(() => {
    clearStore();
  });
  test('getISOWeekNumber', () => {
    const date = Date.parse('2022-01-01T00:00:00.000Z');
    // @ts-ignore
    const weekNumber = getISOWeekNumber(date.getTime());
    assert.stringEquals(weekNumber.toString(), '0');
    // @ts-ignore
    const weekNumber1 = getISOWeekNumber(Date.parse('2022-01-08T00:00:00.000Z').getTime());
    assert.stringEquals(weekNumber1.toString(), '1');
    // @ts-ignore
    const weekNumber2 = getISOWeekNumber(Date.parse('2022-10-11T12:43:00.000Z').getTime());
    assert.stringEquals(weekNumber2.toString(), '41');
    // @ts-ignore
    const weekNumber3 = getISOWeekNumber(Date.parse('2022-12-12T10:26:04.485Z').getTime());
    assert.stringEquals(weekNumber3.toString(), '50');
  });

  test('Handles deposit and withdrawals', () => {
    const nowSeconds = 1640995200; //2022-01-01T00:00:00.000Z
    const oneHour = 60 * 60; // Number of seconds in one hour
    const oneDay = 24 * oneHour; // Number of seconds in one day
    const oneWeek = oneDay * 7; // Number of seconds in one day
    const newMarketRegisteredEvent = createMarketCreatedEvent(
      1,
      address,
      nowSeconds,
      nowSeconds - 1
    );
    const arg = ethereum.Value.fromUnsignedBigInt(BigInt.fromU64(1));
    createMockedFunction(
      Address.fromString(defaultGraphContractAddress),
      'getMarketReportedDebt',
      'getMarketReportedDebt(uint128):(uint256)'
    )
      // @ts-ignore
      .withArgs([arg])
      // @ts-ignore
      .returns([ethereum.Value.fromI32(23)]);
    const newUsdDepositedEvent = createMarketUsdDepositedEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(200),
      nowSeconds,
      nowSeconds - 1
    );
    const newUsdDepositedEventOneHourLater = createMarketUsdDepositedEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(200),
      nowSeconds + oneHour,
      nowSeconds + oneHour - 1
    );
    const newUsdWithdrawnEventNextWeek = createMarketUsdWithdrawnEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(300),
      nowSeconds + oneWeek + oneDay,
      nowSeconds + oneWeek + oneDay - 1
    );
    const newUsdWithdrawnEventNextDay1 = createMarketUsdWithdrawnEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(100),
      nowSeconds + oneWeek + oneDay + oneDay,
      nowSeconds + oneWeek + oneDay + oneDay - 1
    );
    // Trigger market creation and a deposit event
    // We trigger this on the main handler since we expect that to call createMarketSnapshotByWeek
    handleMarketCreated(newMarketRegisteredEvent);
    handleMarketUsdDeposited(newUsdDepositedEvent);
    // Assert Market snapshot is created for the deposit event
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'reported_debt', '23');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_deposited', '200');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_withdrawn', '0');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'net_issuance', '-200');
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'created_at',
      nowSeconds.toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'created_at_block',
      (nowSeconds - 1).toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'updated_at',
      nowSeconds.toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'updated_at_block',
      (nowSeconds - 1).toString()
    );

    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'market', '1');

    // Trigger another deposit in the same week
    handleMarketUsdDeposited(newUsdDepositedEventOneHourLater);

    // Assert Market snapshot can handle deposits on the same week
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'reported_debt', '23');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_deposited', '400');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'usd_withdrawn', '0');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'net_issuance', '-400');
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'created_at',
      nowSeconds.toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'created_at_block',
      (nowSeconds - 1).toString()
    );

    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'updated_at',
      (nowSeconds + oneHour).toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'updated_at_block',
      (nowSeconds + oneHour - 1).toString()
    );
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-0', 'market', '1');

    // Trigger a withdrawal event
    handleMarketUsdWithdrawn(newUsdWithdrawnEventNextWeek);

    // Assert Market snapshot is created for the withdrawal event
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'reported_debt', '23');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'usd_deposited', '400');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'usd_withdrawn', '300');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'net_issuance', '-100');
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'created_at',
      nowSeconds.toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'created_at_block',
      (nowSeconds - 1).toString()
    );

    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-2',
      'updated_at',
      (nowSeconds + oneWeek + oneDay).toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-2',
      'updated_at_block',
      (nowSeconds + oneWeek + oneDay - 1).toString()
    );
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'market', '1');

    // Trigger another withdrawal in the same week
    handleMarketUsdWithdrawn(newUsdWithdrawnEventNextDay1);

    // Assert Market snapshot can handle withdrawal on the same week
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'reported_debt', '23');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'usd_deposited', '400');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'usd_withdrawn', '400');
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'net_issuance', '0');
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'created_at',
      nowSeconds.toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-0',
      'created_at_block',
      (nowSeconds - 1).toString()
    );

    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-2',
      'updated_at',
      (nowSeconds + oneWeek + oneDay + oneDay).toString()
    );
    assert.fieldEquals(
      'MarketSnapshotByWeek',
      '1-week-2022-2',
      'updated_at_block',
      (nowSeconds + oneWeek + oneDay + oneDay - 1).toString()
    );
    assert.fieldEquals('MarketSnapshotByWeek', '1-week-2022-2', 'market', '1');
  });
});
