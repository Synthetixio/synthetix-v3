import { assert, createMockedFunction, log } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { defaultGraphContractAddress } from './constants';
import {
  handleMarketCreated,
  handleMarketUsdDeposited,
  handleMarketUsdWithdrawn,
} from '../mainnet';
import { createMarketRegisteredEvent } from './event-factories/createMarketRegisteredEvent';
import { createMarketUsdDepositedEvent } from './event-factories/createMarketUsdDepositedEvent';
import { createMarketUsdWithdrawnEvent } from './event-factories/createMarketUsdWithdrawnEvent';

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

  log.error('Should create a new Market record', []);

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

  log.error('Should update Market record after withdrawal event', []);

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
  assert.fieldEquals('Market', '1', 'reported_debt', '23');
  assert.fieldEquals('Market', '1', 'usd_deposited', '400');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '300');
  assert.fieldEquals('Market', '1', 'net_issuance', '-100');
  assert.fieldEquals('Market', '1', 'updated_at_block', '1001');
  assert.fieldEquals('Market', '1', 'updated_at', '2001');

  log.error('Should update Market record after second withdrawal event', []);

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

  assert.fieldEquals('Market', '1', 'address', market);
  assert.fieldEquals('Market', '1', 'reported_debt', '23');
  assert.fieldEquals('Market', '1', 'usd_deposited', '400');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '400');
  assert.fieldEquals('Market', '1', 'net_issuance', '0');
  assert.fieldEquals('Market', '1', 'created_at', '1');
  assert.fieldEquals('Market', '1', 'created_at_block', '-999');
  assert.fieldEquals('Market', '1', 'updated_at', '2001');
}
