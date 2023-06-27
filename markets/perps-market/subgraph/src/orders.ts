import { OrderCommitted } from '../generated/PerpsMarket/PerpsMarketProxy';
import { BigInt } from '@graphprotocol/graph-ts';
import { ZERO_BI } from './helpers';
import { Order } from '../generated/schema';

export function handleOrderCommitted(event: OrderCommitted): void {
  let id =
    event.params.sender.toHexString() +
    '-' +
    event.params.marketId.toString() +
    '-' +
    event.params.accountId.toString();

  let order = Order.load(id);

  if (!order) {
    order = new Order(id);
    order.size = ZERO_BI;
  }

  order.marketId = event.params.marketId;
  order.accountId = event.params.accountId;
  order.orderType = event.params.orderType;
  order.acceptablePrice = event.params.acceptablePrice;
  order.settlementTime = event.params.settlementTime;
  order.expirationTime = event.params.expirationTime;
  order.trackingCode = event.params.trackingCode;
  order.owner = event.params.sender.toHexString();

  let sizeDelta = BigInt.fromString(event.params.sizeDelta.toString());
  order.size = order.size.plus(sizeDelta);

  order.block = event.block.number;
  order.timestamp = event.block.timestamp;

  order.save();
}
