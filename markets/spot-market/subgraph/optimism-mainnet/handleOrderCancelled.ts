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

  order.amountEscrowed = event.params.asyncOrderClaim.amountEscrowed;
  order.settlementStrategyId = event.params.asyncOrderClaim.settlementStrategyId;
  order.commitmentTime = event.params.asyncOrderClaim.commitmentTime;
  order.minimumSettlementAmount = event.params.asyncOrderClaim.minimumSettlementAmount;
  order.settledAt = event.params.asyncOrderClaim.settledAt;

  order.save();
}
