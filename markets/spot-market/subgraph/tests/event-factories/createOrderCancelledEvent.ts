import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import {
  OrderCancelled as OrderCancelledEvent,
  OrderCancelledAsyncOrderClaimStruct,
} from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createOrderCancelledEvent(
  marketId: i32,
  asyncOrderId: i64,
  // asyncOrderClaim tuple
  claimId: i64,
  owner: string,
  orderType: i32,
  amountEscrowed: i64,
  settlementStrategyId: i64,
  settlementTime: i64,
  minimumSettlementAmount: i64,
  settledAt: i64,
  referrer: string,
  // end of asyncOrderClaim tuple
  sender: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): OrderCancelledEvent {
  const event = newTypedMockEvent<OrderCancelledEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam(
      'asyncOrderId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(asyncOrderId))
    )
  );

  const asyncOrderClaim = changetype<OrderCancelledAsyncOrderClaimStruct>([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(claimId)),
    ethereum.Value.fromAddress(Address.fromString(owner)),
    ethereum.Value.fromI32(orderType),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amountEscrowed)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementStrategyId)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementTime)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(minimumSettlementAmount)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settledAt)),
    ethereum.Value.fromAddress(Address.fromString(referrer)),
  ]);
  event.parameters.push(
    new ethereum.EventParam('asyncOrderClaim', ethereum.Value.fromTuple(asyncOrderClaim))
  );

  event.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
