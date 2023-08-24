import { OrderSettled } from '../generated/SpotMarketProxy/SpotMarketProxy';
import { Order } from '../generated/schema';
import { addClaimToOrder } from './addClaimToOrder';

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

  addClaimToOrder(
    order,
    event.address,
    event.params.marketId,
    event.params.asyncOrderId,
    'Settled'
  );

  order.save();
}
