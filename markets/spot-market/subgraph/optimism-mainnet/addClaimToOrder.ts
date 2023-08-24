import { Address, BigInt } from '@graphprotocol/graph-ts';
import { SpotMarketProxy } from './generated/SpotMarketProxy/SpotMarketProxy';
import { Order } from './generated/schema';

export function addClaimToOrder(
  order: Order,
  address: Address,
  marketId: BigInt,
  asyncOrderId: BigInt,
  status: string | null
): void {
  let claim = SpotMarketProxy.bind(address).getAsyncOrderClaim(marketId, asyncOrderId);

  order.status = status;

  order.amountEscrowed = claim.amountEscrowed;
  order.settlementStrategyId = claim.settlementStrategyId;
  order.settlementTime = claim.settlementTime;
  order.minimumSettlementAmount = claim.minimumSettlementAmount;
  order.settledAt = claim.settledAt;
}
