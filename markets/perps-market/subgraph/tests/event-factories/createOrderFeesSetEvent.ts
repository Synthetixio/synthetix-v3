import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { OrderFeesSet as OrderFeesSetEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createOrderFeesSetEvent(
  marketId: i32,
  makerFeeRatio: i64,
  takerFeeRatio: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): OrderFeesSetEvent {
  const event = newTypedMockEvent<OrderFeesSetEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam(
      'makerFeeRatio',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(makerFeeRatio))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'takerFeeRatio',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(takerFeeRatio))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
