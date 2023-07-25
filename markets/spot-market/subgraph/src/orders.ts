import { Address, BigInt } from '@graphprotocol/graph-ts';
import {
  OrderCancelled,
  OrderCommitted,
  OrderSettled,
  SpotMarketProxy,
  SynthUnwrapped,
  SynthWrapped,
} from '../generated/SpotMarketProxy/SpotMarketProxy';

import { Order, WrappSynth } from '../generated/schema';

function addClaimToOrder(
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

export function handleSynthWrapped(event: SynthWrapped): void {
  let id = event.transaction.hash.toHexString() + '/' + event.logIndex.toString();
  let synth = new WrappSynth(id);

  synth.marketId = event.params.synthMarketId;
  synth.amount = event.params.amountWrapped;
  synth.collectedFees = event.params.feesCollected;
  synth.wrapperFees = event.params.fees.wrapperFees;
  synth.type = 'Wrapped';
  synth.block = event.block.number;
  synth.timestamp = event.block.timestamp;

  synth.save();
}

export function handleSynthUnWrapped(event: SynthUnwrapped): void {
  let id = event.transaction.hash.toHexString() + '/' + event.logIndex.toString();
  let synth = new WrappSynth(id);

  synth.marketId = event.params.synthMarketId;
  synth.amount = event.params.amountUnwrapped;
  synth.collectedFees = event.params.feesCollected;
  synth.wrapperFees = event.params.fees.wrapperFees;
  synth.type = 'UnWrapped';
  synth.block = event.block.number;
  synth.timestamp = event.block.timestamp;

  synth.save();
}
