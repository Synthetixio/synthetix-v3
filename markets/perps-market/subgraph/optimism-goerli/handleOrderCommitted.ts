import { BigInt } from '@graphprotocol/graph-ts';
import { OrderCommitted as OrderCommittedEvent } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Order, OrderCommitted } from './generated/schema';

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
    order.size = BigInt.fromI32(0);
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
