import {
  OrderCommitted as OrderCommittedEvent,
  OrderSettled as OrderSettledEvent,
  MarketUpdated as MarketUpdatedEvent,
} from '../generated/PerpsMarketProxy/PerpsMarketProxy';
import { BigInt } from '@graphprotocol/graph-ts';
import { ZERO_BI } from './helpers';
import { Order, OrderCommitted, OrderSettled, MarketUpdated } from '../generated/schema';

export function handleOrderCommitted(event: OrderCommittedEvent): void {
  const orderId = event.params.marketId.toString() + '-' + event.params.accountId.toString();
  const orderCommittedId =
    event.params.marketId.toString() +
    '-' +
    event.params.accountId.toString() +
    '-' +
    event.block.number.toString();

  // create Order entity
  let order = Order.load(orderId);

  if (!order) {
    order = new Order(orderId);
    order.size = ZERO_BI;
    order.newSize = ZERO_BI;
  }

  order.marketId = event.params.marketId;
  order.accountId = event.params.accountId;
  order.orderType = event.params.orderType;
  order.acceptablePrice = event.params.acceptablePrice;
  order.settlementTime = event.params.settlementTime;
  order.expirationTime = event.params.expirationTime;
  order.trackingCode = event.params.trackingCode;
  order.owner = event.params.sender.toHexString();
  order.size = event.params.sizeDelta;

  order.block = event.block.number;
  order.timestamp = event.block.timestamp;

  order.save();

  // create OrderCommitted entity
  let orderCommitted = new OrderCommitted(orderCommittedId);

  orderCommitted.timestamp = event.block.timestamp;
  orderCommitted.marketId = event.params.marketId;
  orderCommitted.accountId = event.params.accountId;
  orderCommitted.orderType = event.params.orderType;
  orderCommitted.sizeDelta = event.params.sizeDelta;
  orderCommitted.acceptablePrice = event.params.acceptablePrice;
  orderCommitted.settlementTime = event.params.settlementTime;
  orderCommitted.expirationTime = event.params.expirationTime;
  orderCommitted.trackingCode = event.params.trackingCode;
  orderCommitted.sender = event.params.sender;

  orderCommitted.save();
}

export function handleOrderSettled(event: OrderSettledEvent): void {
  const orderId = event.params.marketId.toString() + '-' + event.params.accountId.toString();
  const orderSettledId =
    event.params.marketId.toString() +
    '-' +
    event.params.accountId.toString() +
    '-' +
    event.block.number.toString();

  // update Order entity
  let order = Order.load(orderId);

  if (!order) {
    order = new Order(orderId);
    order.size = ZERO_BI;
    order.newSize = ZERO_BI;
  }

  order.marketId = event.params.marketId;
  order.accountId = event.params.accountId;
  order.newSize = event.params.newSize;
  order.fillPrice = event.params.fillPrice;
  order.settlementReward = event.params.settlementReward;
  order.collectedFees = event.params.collectedFees;
  order.settler = event.params.settler.toHexString();

  order.block = event.block.number;
  order.timestamp = event.block.timestamp;

  order.save();

  // create OrderSettled entity
  let orderSettled = new OrderSettled(orderSettledId);
  orderSettled.timestamp = event.block.timestamp;
  orderSettled.marketId = event.params.marketId;
  orderSettled.accountId = event.params.accountId;
  orderSettled.fillPrice = event.params.fillPrice;
  orderSettled.sizeDelta = event.params.sizeDelta;
  orderSettled.newSize = event.params.newSize;
  orderSettled.totalFees = event.params.totalFees;
  orderSettled.referralFees = event.params.referralFees;
  orderSettled.collectedFees = event.params.collectedFees;
  orderSettled.settlementReward = event.params.settlementReward;
  orderSettled.trackingCode = event.params.trackingCode;
  orderSettled.settler = event.params.settler;

  orderSettled.save();
}
