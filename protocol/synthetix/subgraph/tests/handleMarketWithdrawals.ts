import { assert, createMockedFunction } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { address, address2, defaultGraphContractAddress } from './constants';
import { handleMarketCreated, handleMarketUsdDeposited, handleMarketUsdWithdrawn } from '../src';
import {
  createMarketCreatedEvent,
  createMarketUsdDepositedEvent,
  createMarketUsdWithdrawnEvent,
} from './event-factories';

export default function test(): void {
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
  handleMarketUsdDeposited(newUsdDepositedEvent1);

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
}
