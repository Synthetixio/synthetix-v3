import { assert, createMockedFunction } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { address, address2, defaultGraphContractAddress } from './constants';
import { handleMarketCreated, handleMarketUsdDeposited } from '../mainnet';
import { createMarketCreatedEvent, createMarketUsdDepositedEvent } from './event-factories';

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

  assert.notInStore('Market', '2');
}
