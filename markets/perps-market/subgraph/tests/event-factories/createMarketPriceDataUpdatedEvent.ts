import { BigInt, ethereum, Bytes } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { MarketPriceDataUpdated as MarketPriceDataUpdatedEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createMarketPriceDataUpdatedEvent(
  marketId: i32,
  feedId: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): MarketPriceDataUpdatedEvent {
  const event = newTypedMockEvent<MarketPriceDataUpdatedEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam(
      'feedId',
      ethereum.Value.fromBytes(Bytes.fromHexString(feedId) as Bytes)
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
