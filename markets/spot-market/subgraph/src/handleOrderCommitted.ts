import { OrderCommitted } from '../generated/SpotMarketProxy/SpotMarketProxy';
import { Order } from '../generated/schema';
import { addClaimToOrder } from './addClaimToOrder';

export function handleOrderCommitted(event: OrderCommitted): void {
  let id = event.params.asyncOrderId.toString();
  let order = new Order(id);

  order.asyncOrderId = event.params.asyncOrderId;
  order.marketId = event.params.marketId;
  order.amountProvided = event.params.amountProvided;
  order.orderType = event.params.orderType;
  order.referrer = event.params.referrer.toHexString();
  order.owner = event.params.sender.toHexString();

  order.block = event.block.number;
  order.timestamp = event.block.timestamp;

  addClaimToOrder(
    order,
    event.address,
    event.params.marketId,
    event.params.asyncOrderId,
    'Commited'
  );

  order.save();
}
