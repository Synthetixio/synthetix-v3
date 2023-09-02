import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { MarketUpdated as MarketUpdatedEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createMarketUpdatedEvent(
  marketId: i32,
  price: i64,
  skew: i64,
  size: i64,
  sizeDelta: i64,
  currentFundingRate: i64,
  currentFundingVelocity: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): MarketUpdatedEvent {
  const event = newTypedMockEvent<MarketUpdatedEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam('price', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(price)))
  );
  event.parameters.push(
    new ethereum.EventParam('skew', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(skew)))
  );
  event.parameters.push(
    new ethereum.EventParam('size', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(size)))
  );
  event.parameters.push(
    new ethereum.EventParam(
      'sizeDelta',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(sizeDelta))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'currentFundingRate',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(currentFundingRate))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'currentFundingVelocity',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(currentFundingVelocity))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
