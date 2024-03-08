import { assert, log } from 'matchstick-as';
import { handleOrderCommitted } from '../optimism-mainnet';
import { createOrderCommittedEvent } from './event-factories/createOrderCommittedEvent';

export default function test(): void {
  assert.entityCount('Order', 0);

  let marketId = 1;
  let orderType = 2;
  let amountProvided = 100000;
  let asyncOrderId = 100001;
  let sender = '0x4200000000000000000000000000000000000000';
  let referrer = '0x6900000000000000000000000000000000000000';
  let timestamp = 1_000_000;
  let blockNumber = 1;
  let logIndex = 1;

  log.info('Should create a new Order for testing', []);
  handleOrderCommitted(
    createOrderCommittedEvent(
      marketId,
      orderType,
      amountProvided,
      asyncOrderId,
      sender,
      referrer,
      timestamp,
      blockNumber,
      logIndex
    )
  );
  assert.entityCount('Order', 1);

  let id = asyncOrderId.toString();
  assert.fieldEquals('Order', id, 'asyncOrderId', asyncOrderId.toString());
  assert.fieldEquals('Order', id, 'marketId', marketId.toString());
  assert.fieldEquals('Order', id, 'amountProvided', amountProvided.toString());
  assert.fieldEquals('Order', id, 'orderType', orderType.toString());
  assert.fieldEquals('Order', id, 'referrer', referrer);
  assert.fieldEquals('Order', id, 'owner', sender);
  assert.fieldEquals('Order', id, 'block', blockNumber.toString());
  assert.fieldEquals('Order', id, 'timestamp', timestamp.toString());
  assert.fieldEquals('Order', id, 'status', 'Commited');
}
