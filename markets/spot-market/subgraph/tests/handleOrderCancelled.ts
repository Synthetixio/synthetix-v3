import { assert, log } from 'matchstick-as';
import { handleOrderCommitted, handleOrderCancelled } from '../optimism-mainnet';
import { createOrderCommittedEvent } from './event-factories/createOrderCommittedEvent';
import { createOrderCancelledEvent } from './event-factories/createOrderCancelledEvent';

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

  let claimId = 10002;
  let amountEscrowed = 2000;
  let settlementStrategyId = 69;
  let settlementTime = 1_000_000;
  let minimumSettlementAmount = 100;
  let settledAt = 1_000_000;

  log.info('Should not update a non-existent entity', []);
  handleOrderCancelled(
    createOrderCancelledEvent(
      marketId,
      200002,
      claimId,
      sender,
      orderType,
      amountEscrowed,
      settlementStrategyId,
      settlementTime,
      minimumSettlementAmount,
      settledAt,
      referrer,
      sender,
      timestamp + 60_000,
      blockNumber + 6,
      logIndex + 1
    )
  );
  assert.entityCount('Order', 1);

  log.info('Should update the existing entity', []);
  handleOrderCancelled(
    createOrderCancelledEvent(
      marketId,
      asyncOrderId,
      claimId,
      sender,
      orderType,
      amountEscrowed,
      settlementStrategyId,
      settlementTime,
      minimumSettlementAmount,
      settledAt,
      referrer,
      sender,
      timestamp + 20_000,
      blockNumber + 2,
      logIndex + 1
    )
  );

  let id = asyncOrderId.toString();
  assert.fieldEquals('Order', id, 'amountEscrowed', amountEscrowed.toString());
  assert.fieldEquals('Order', id, 'settlementStrategyId', settlementStrategyId.toString());
  assert.fieldEquals('Order', id, 'settlementTime', settlementTime.toString());
  assert.fieldEquals('Order', id, 'minimumSettlementAmount', minimumSettlementAmount.toString());
  assert.fieldEquals('Order', id, 'settledAt', settledAt.toString());
  assert.fieldEquals('Order', id, 'block', (blockNumber + 2).toString());
  assert.fieldEquals('Order', id, 'timestamp', (timestamp + 20_000).toString());
  assert.fieldEquals('Order', id, 'status', 'Cancelled');
}
