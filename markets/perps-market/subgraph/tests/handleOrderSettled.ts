import { assert, log } from 'matchstick-as';
import {
  handleMarketCreated,
  handleOrderCommitted,
  handleOrderSettled,
} from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createOrderCommittedEvent } from './event-factories/createOrderCommittedEvent';
import { createOrderSettledEvent } from './event-factories/createOrderSettledEvent';

export default function test(): void {
  assert.entityCount('Market', 0);
  assert.entityCount('Order', 0);
  assert.entityCount('OrderSettled', 0);
  assert.entityCount('OrderCommitted', 0);

  assert.entityCount('Market', 0);

  const perpsMarketId = 1;
  const marketName = 'Test Market';
  const marketSymbol = 'TM';
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;

  handleMarketCreated(
    createMarketCreatedEvent(
      perpsMarketId,
      marketName,
      marketSymbol,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);

  log.info('Should create a new OrderSettled record', []);

  let fillPrice = 500;
  let pnl = 600;
  let accruedFunding = 700;
  let sizeDelta = 300;
  let newSize = 800;
  let totalFees = 900;
  let referralFees = 1000;
  let collectedFees = 1100;
  let settlementReward = 1200;
  let trackingCode = '0xbebebe';
  let settler = '0x6900000000000000000000000000000000000000';
  let accountId = 1;

  handleOrderSettled(
    createOrderSettledEvent(
      perpsMarketId,
      accountId,
      fillPrice,
      pnl,
      accruedFunding,
      sizeDelta,
      newSize,
      totalFees,
      referralFees,
      collectedFees,
      settlementReward,
      trackingCode,
      settler,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.entityCount('Order', 1);
  assert.entityCount('OrderSettled', 1);

  const orderId = perpsMarketId.toString() + '-' + accountId.toString();
  assert.fieldEquals('Order', orderId, 'size', '0');
  assert.fieldEquals('Order', orderId, 'newSize', newSize.toString());

  assert.fieldEquals('Order', orderId, 'marketId', perpsMarketId.toString());
  assert.fieldEquals('Order', orderId, 'accountId', accountId.toString());
  assert.fieldEquals('Order', orderId, 'fillPrice', fillPrice.toString());
  assert.fieldEquals('Order', orderId, 'settlementReward', settlementReward.toString());
  assert.fieldEquals('Order', orderId, 'collectedFees', collectedFees.toString());
  assert.fieldEquals('Order', orderId, 'settler', settler.toString());

  assert.fieldEquals('Order', orderId, 'block', blockNumber.toString());
  assert.fieldEquals('Order', orderId, 'timestamp', timestamp.toString());

  let orderSettledId =
    perpsMarketId.toString() + '-' + accountId.toString() + '-' + blockNumber.toString();

  assert.fieldEquals('OrderSettled', orderSettledId, 'timestamp', timestamp.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'marketId', perpsMarketId.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'accountId', accountId.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'fillPrice', fillPrice.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'accruedFunding', accruedFunding.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'sizeDelta', sizeDelta.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'newSize', newSize.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'totalFees', totalFees.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'referralFees', referralFees.toString());
  assert.fieldEquals('OrderSettled', orderSettledId, 'collectedFees', collectedFees.toString());
  assert.fieldEquals(
    'OrderSettled',
    orderSettledId,
    'settlementReward',
    settlementReward.toString()
  );
  assert.fieldEquals('OrderSettled', orderSettledId, 'trackingCode', trackingCode);
  assert.fieldEquals('OrderSettled', orderSettledId, 'settler', settler.toString());
}
