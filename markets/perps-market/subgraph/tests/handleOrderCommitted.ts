import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleOrderCommitted } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createOrderCommittedEvent } from './event-factories/createOrderCommittedEvent';

export default function test(): void {
  assert.entityCount('Market', 0);
  assert.entityCount('Order', 0);
  assert.entityCount('OrderCommitted', 0);

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

  log.info('Should add a new Order and OrderCommitted records', []);

  let accountId = 1;
  let orderType = 2;
  let sizeDelta = 300;
  let acceptablePrice = 400;
  let settlementTime = 500;
  let expirationTime = 600;
  let trackingCode = '0xbebebe';
  let sender = '0x6900000000000000000000000000000000000000';

  handleOrderCommitted(
    createOrderCommittedEvent(
      perpsMarketId,
      accountId,
      orderType,
      sizeDelta,
      acceptablePrice,
      settlementTime,
      expirationTime,
      trackingCode,
      sender,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.entityCount('Order', 1);
  assert.entityCount('OrderCommitted', 1);

  const orderId = perpsMarketId.toString() + '-' + accountId.toString();
  assert.fieldEquals('Order', orderId, 'size', sizeDelta.toString());
  assert.fieldEquals('Order', orderId, 'orderType', orderType.toString());
  assert.fieldEquals('Order', orderId, 'marketId', perpsMarketId.toString());
  assert.fieldEquals('Order', orderId, 'accountId', accountId.toString());
  assert.fieldEquals('Order', orderId, 'acceptablePrice', acceptablePrice.toString());
  assert.fieldEquals('Order', orderId, 'settlementTime', settlementTime.toString());
  assert.fieldEquals('Order', orderId, 'trackingCode', trackingCode);
  assert.fieldEquals('Order', orderId, 'owner', sender);
  assert.fieldEquals('Order', orderId, 'block', blockNumber.toString());
  assert.fieldEquals('Order', orderId, 'timestamp', timestamp.toString());

  let orderCommittedId =
    perpsMarketId.toString() + '-' + accountId.toString() + '-' + blockNumber.toString();
  assert.fieldEquals('OrderCommitted', orderCommittedId, 'sizeDelta', sizeDelta.toString());
  assert.fieldEquals('OrderCommitted', orderCommittedId, 'orderType', orderType.toString());
  assert.fieldEquals('OrderCommitted', orderCommittedId, 'timestamp', timestamp.toString());
  assert.fieldEquals('OrderCommitted', orderCommittedId, 'marketId', perpsMarketId.toString());
  assert.fieldEquals('OrderCommitted', orderCommittedId, 'accountId', accountId.toString());
  assert.fieldEquals(
    'OrderCommitted',
    orderCommittedId,
    'acceptablePrice',
    acceptablePrice.toString()
  );
  assert.fieldEquals(
    'OrderCommitted',
    orderCommittedId,
    'settlementTime',
    settlementTime.toString()
  );
  assert.fieldEquals('OrderCommitted', orderCommittedId, 'trackingCode', trackingCode);
  assert.fieldEquals('OrderCommitted', orderCommittedId, 'sender', sender.toString());

  log.info('Should update existing Order record and add another OrderCommitted record', []);

  handleOrderCommitted(
    createOrderCommittedEvent(
      perpsMarketId,
      accountId,
      orderType,
      sizeDelta,
      acceptablePrice,
      800,
      expirationTime,
      trackingCode,
      sender,
      timestamp,
      blockNumber + 1,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.entityCount('Order', 1);
  assert.entityCount('OrderCommitted', 2);

  assert.fieldEquals('Order', orderId, 'settlementTime', '800');

  orderCommittedId =
    perpsMarketId.toString() + '-' + accountId.toString() + '-' + (blockNumber + 1).toString();
  assert.fieldEquals('OrderCommitted', orderCommittedId, 'settlementTime', '800');
}
