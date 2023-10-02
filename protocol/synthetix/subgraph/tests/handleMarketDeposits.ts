import { assert, createMockedFunction } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { defaultGraphContractAddress } from './constants';
import { handleMarketCreated, handleMarketUsdDeposited } from '../mainnet';
import { createMarketRegisteredEvent } from './event-factories/createMarketRegisteredEvent';
import { createMarketUsdDepositedEvent } from './event-factories/createMarketUsdDepositedEvent';

export default function test(): void {
  const sender = '0x6942000000000000000000000000000000000000';
  const marketId = 1;
  const target = '0x4200000000000000000000000000000000000000';
  const amount = 200;
  const market = '0x6900000000000000000000000000000000000000';
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;

  createMockedFunction(
    Address.fromString(defaultGraphContractAddress),
    'getMarketReportedDebt',
    'getMarketReportedDebt(uint128):(uint256)'
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromU64(marketId))])
    .returns([ethereum.Value.fromI32(42)]);

  handleMarketCreated(
    createMarketRegisteredEvent(market, marketId, sender, timestamp, blockNumber, logIndex)
  );

  // Trigger market creation and a deposit event
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

  // Assert Market snapshot is created for the deposit event
  assert.fieldEquals('Market', '1', 'reported_debt', '23');
  assert.fieldEquals('Market', '1', 'usd_deposited', '200');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
  assert.fieldEquals('Market', '1', 'net_issuance', '-200');
  assert.fieldEquals('Market', '1', 'updated_at_block', '1');
  assert.fieldEquals('Market', '1', 'updated_at', '1001');

  // Trigger another deposit in the same block
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

  // Assert Market snapshot can handle deposits on the same block
  assert.fieldEquals('Market', '1', 'reported_debt', '23');
  assert.fieldEquals('Market', '1', 'usd_deposited', '400');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
  assert.fieldEquals('Market', '1', 'net_issuance', '-400');
  assert.fieldEquals('Market', '1', 'updated_at_block', '1');
  assert.fieldEquals('Market', '1', 'updated_at', '1001');

  assert.notInStore('Market', '2');
}
