import { OrderSettled } from './generated/SpotMarketProxy/SpotMarketProxy';
import { Order } from './generated/schema';

export function handleOrderSettled(event: OrderSettled): void {
  let id = event.params.asyncOrderId.toString();

  let order = Order.load(id);

  if (!order) {
    return;
  }

  order.asyncOrderId = event.params.asyncOrderId;
  order.marketId = event.params.marketId;
  order.finalOrderAmount = event.params.finalOrderAmount;
  order.collectedFees = event.params.collectedFees;
  order.settler = event.params.settler.toHexString();
  order.fixedFees = event.params.fees.fixedFees;
  order.skewFees = event.params.fees.skewFees;
  order.utilizationFees = event.params.fees.utilizationFees;
  order.wrapperFees = event.params.fees.wrapperFees;
  order.price = event.params.price;
  order.block = event.block.number;
  order.timestamp = event.block.timestamp;

  order.status = 'Settled';

  // TODO: order claim may need to be added to OrderSettled event
  // let claim = event.params.asyncOrderClaim;
  // order.amountEscrowed = claim.amountEscrowed;
  // order.settlementStrategyId = claim.settlementStrategyId;
  // order.settlementTime = claim.settlementTime;
  // order.minimumSettlementAmount = claim.minimumSettlementAmount;
  // order.settledAt = claim.settledAt;

  order.save();
}
