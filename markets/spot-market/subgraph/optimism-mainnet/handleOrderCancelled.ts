import { OrderCancelled } from './generated/SpotMarketProxy/SpotMarketProxy';
import { Order } from './generated/schema';
import { addClaimToOrder } from './addClaimToOrder';

export function handleOrderCancelled(event: OrderCancelled): void {
  let id = event.params.asyncOrderId.toString();
  let order = Order.load(id);

  if (!order) {
    return;
  }

  order.block = event.block.number;
  order.timestamp = event.block.timestamp;

  addClaimToOrder(
    order,
    event.address,
    event.params.marketId,
    event.params.asyncOrderId,
    'Cancelled'
  );

  order.save();
}
