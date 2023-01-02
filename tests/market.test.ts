import {
  test,
  assert,
  clearStore,
  describe,
  beforeEach,
  createMockedFunction,
} from 'matchstick-as';
import { Address, ethereum, BigInt, store } from '@graphprotocol/graph-ts';
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

describe('Market tests', () => {
  beforeEach(() => {
    clearStore();
  });

  test('handleMarketCreated', () => {
    // Needs to be here because of Closures
    const now = 10_000;
    const newMarketRegisteredEvent = createMarketCreatedEvent(1, address, now, now - 1000);
    handleMarketCreated(newMarketRegisteredEvent);
    assert.fieldEquals('Market', '1', 'id', '1');
    assert.fieldEquals('Market', '1', 'address', address);
    assert.fieldEquals('Market', '1', 'created_at', '10000');
    assert.fieldEquals('Market', '1', 'created_at_block', '9000');
    assert.fieldEquals('Market', '1', 'updated_at', '10000');
    assert.fieldEquals('Market', '1', 'updated_at_block', '9000');
    assert.fieldEquals('Market', '1', 'usd_deposited', '0');
    assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
    assert.fieldEquals('Market', '1', 'net_issuance', '0');
    assert.fieldEquals('Market', '1', 'reported_debt', '0');
    assert.notInStore('Market', '2');
  });

  test('Market handles market withdrawals and deposits', () => {
    // Needs to be here because of Closures
    const now = 1;
    const newMarketRegisteredEvent = createMarketCreatedEvent(1, address, now, now - 1000);
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
      now + 1000,
      now
    );
    const newUsdDepositedEvent1 = createMarketUsdDepositedEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(200),
      now + 1000,
      now
    );
    const newUsdWithdrawnEvent = createMarketUsdWithdrawnEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(300),
      now + 2000,
      now + 1000
    );
    const newUsdWithdrawnEvent1 = createMarketUsdWithdrawnEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(100),
      now + 2000,
      now + 1000
    );
    // Trigger market creation and a deposit event
    handleMarketCreated(newMarketRegisteredEvent);
    handleMarketUsdDeposited(newUsdDepositedEvent);

    // Assert Market snapshot is created for the deposit event
    assert.fieldEquals('Market', '1', 'reported_debt', '23');
    assert.fieldEquals('Market', '1', 'usd_deposited', '200');
    assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
    assert.fieldEquals('Market', '1', 'net_issuance', '-200');
    assert.fieldEquals('Market', '1', 'updated_at_block', '1');
    assert.fieldEquals('Market', '1', 'updated_at', '1001');

    // Trigger another deposit in the same block
    handleMarketUsdDeposited(newUsdDepositedEvent1);

    // Assert Market snapshot can handle deposits on the same block
    assert.fieldEquals('Market', '1', 'reported_debt', '23');
    assert.fieldEquals('Market', '1', 'usd_deposited', '400');
    assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
    assert.fieldEquals('Market', '1', 'net_issuance', '-400');
    assert.fieldEquals('Market', '1', 'updated_at_block', '1');
    assert.fieldEquals('Market', '1', 'updated_at', '1001');

    // Trigger a withdrawal event
    handleMarketUsdWithdrawn(newUsdWithdrawnEvent);

    // Assert Market snapshot is created for the withdrawal event
    assert.fieldEquals('Market', '1', 'reported_debt', '23');
    assert.fieldEquals('Market', '1', 'usd_deposited', '400');
    assert.fieldEquals('Market', '1', 'usd_withdrawn', '300');
    assert.fieldEquals('Market', '1', 'net_issuance', '-100');
    assert.fieldEquals('Market', '1', 'updated_at_block', '1001');
    assert.fieldEquals('Market', '1', 'updated_at', '2001');

    // Trigger another withdrawal in the same block
    handleMarketUsdWithdrawn(newUsdWithdrawnEvent1);

    /* Assert that the market has the most recent values */
    assert.fieldEquals('Market', '1', 'address', address);
    assert.fieldEquals('Market', '1', 'reported_debt', '23');
    assert.fieldEquals('Market', '1', 'usd_deposited', '400');
    assert.fieldEquals('Market', '1', 'usd_withdrawn', '400');
    assert.fieldEquals('Market', '1', 'net_issuance', '0');
    assert.fieldEquals('Market', '1', 'created_at', '1');
    assert.fieldEquals('Market', '1', 'created_at_block', '-999');
    assert.fieldEquals('Market', '1', 'updated_at', '2001');
    assert.notInStore('Market', '2');
  });
});
