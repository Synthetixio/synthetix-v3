import { OrderCommitted } from './generated/SpotMarketProxy/SpotMarketProxy';
import { Order } from './generated/schema';

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

  order.status = 'Commited';

  // TODO: order claim may need to be added to OrderCommitted event again (used to be there)
  // let claim = event.params.asyncOrderClaim;
  // order.amountEscrowed = claim.amountEscrowed;
  // order.settlementStrategyId = claim.settlementStrategyId;
  // order.settlementTime = claim.settlementTime;
  // order.minimumSettlementAmount = claim.minimumSettlementAmount;
  // order.settledAt = claim.settledAt;

  order.save();
}
