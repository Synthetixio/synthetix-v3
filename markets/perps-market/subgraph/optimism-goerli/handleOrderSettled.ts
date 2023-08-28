import { BigInt } from '@graphprotocol/graph-ts';
import { OrderSettled as OrderSettledEvent } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Order, OrderSettled } from './generated/schema';

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
    order.size = BigInt.fromI32(0);
    order.newSize = BigInt.fromI32(0);
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
  orderSettled.accruedFunding = event.params.accruedFunding;
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
