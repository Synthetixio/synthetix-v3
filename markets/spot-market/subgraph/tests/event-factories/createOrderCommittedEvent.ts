import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { OrderCommitted as OrderCommittedEvent } from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createOrderCommittedEvent(
  marketId: i32,
  orderType: i32,
  amountProvided: i64,
  asyncOrderId: i64,
  sender: string,
  referrer: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): OrderCommittedEvent {
  const event = newTypedMockEvent<OrderCommittedEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(new ethereum.EventParam('orderType', ethereum.Value.fromI32(orderType)));
  event.parameters.push(
    new ethereum.EventParam(
      'amountProvided',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amountProvided))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'asyncOrderId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(asyncOrderId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );
  event.parameters.push(
    new ethereum.EventParam('referrer', ethereum.Value.fromAddress(Address.fromString(referrer)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
