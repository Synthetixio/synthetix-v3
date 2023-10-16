import { OrderCancelled } from './generated/SpotMarketProxy/SpotMarketProxy';
import { Order } from './generated/schema';

export function handleOrderCancelled(event: OrderCancelled): void {
  let id = event.params.asyncOrderId.toString();
  let order = Order.load(id);

  if (!order) {
    return;
  }

  order.block = event.block.number;
  order.timestamp = event.block.timestamp;

  order.status = 'Cancelled';

  let claim = event.params.asyncOrderClaim;
  order.amountEscrowed = claim.amountEscrowed;
  order.settlementStrategyId = claim.settlementStrategyId;
  order.settlementTime = claim.settlementTime;
  order.minimumSettlementAmount = claim.minimumSettlementAmount;
  order.settledAt = claim.settledAt;

  order.save();
}
