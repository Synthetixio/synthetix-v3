import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { MarketCreated as MarketCreatedEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createMarketCreatedEvent(
  perpsMarketId: i32,
  marketName: string,
  marketSymbol: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): MarketCreatedEvent {
  const event = newTypedMockEvent<MarketCreatedEvent>();

  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam('perpsMarketId', ethereum.Value.fromI32(perpsMarketId))
  );
  event.parameters.push(
    new ethereum.EventParam('marketName', ethereum.Value.fromString(marketName))
  );
  event.parameters.push(
    new ethereum.EventParam('marketSymbol', ethereum.Value.fromString(marketSymbol))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
