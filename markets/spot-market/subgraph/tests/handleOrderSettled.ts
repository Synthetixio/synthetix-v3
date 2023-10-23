import { assert, log } from 'matchstick-as';
import { handleOrderCommitted, handleOrderSettled } from '../optimism-mainnet';
import { createOrderCommittedEvent } from './event-factories/createOrderCommittedEvent';
import { createOrderSettledEvent } from './event-factories/createOrderSettledEvent';

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

  let finalOrderAmount = amountProvided;
  let fixedFees = 1;
  let utilizationFees = 2;
  let skewFees = 3;
  let wrapperFees = 4;
  let collectedFees = 420;
  let settler = '0x4200000000000000000000000000000000000069';
  let price = 300_000;

  log.info('Should not create a non-existent entity', []);
  handleOrderSettled(
    createOrderSettledEvent(
      marketId,
      200_002,
      finalOrderAmount,
      fixedFees,
      utilizationFees,
      skewFees,
      wrapperFees,
      collectedFees,
      settler,
      price,
      timestamp + 40_000,
      blockNumber + 4,
      logIndex + 1
    )
  );
  assert.entityCount('Order', 1);

  log.info('Should update the existing entity', []);
  handleOrderSettled(
    createOrderSettledEvent(
      marketId,
      asyncOrderId,
      finalOrderAmount,
      fixedFees,
      utilizationFees,
      skewFees,
      wrapperFees,
      collectedFees,
      settler,
      price,
      timestamp + 10_000,
      blockNumber + 1,
      logIndex + 1
    )
  );

  let id = asyncOrderId.toString();
  assert.fieldEquals('Order', id, 'finalOrderAmount', finalOrderAmount.toString());
  assert.fieldEquals('Order', id, 'collectedFees', collectedFees.toString());
  assert.fieldEquals('Order', id, 'settler', settler);
  assert.fieldEquals('Order', id, 'fixedFees', fixedFees.toString());
  assert.fieldEquals('Order', id, 'skewFees', skewFees.toString());
  assert.fieldEquals('Order', id, 'utilizationFees', utilizationFees.toString());
  assert.fieldEquals('Order', id, 'wrapperFees', wrapperFees.toString());
  assert.fieldEquals('Order', id, 'price', price.toString());
  assert.fieldEquals('Order', id, 'block', (blockNumber + 1).toString());
  assert.fieldEquals('Order', id, 'timestamp', (timestamp + 10_000).toString());
  assert.fieldEquals('Order', id, 'status', 'Settled');
}
