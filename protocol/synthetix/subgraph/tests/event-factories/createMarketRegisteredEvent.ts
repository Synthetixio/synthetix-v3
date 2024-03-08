import { BigInt, ethereum, Address } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { MarketRegistered as MarketRegisteredEvent } from '../../mainnet/generated/CoreProxy/CoreProxy';

export function createMarketRegisteredEvent(
  market: string,
  marketId: i32,
  sender: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): MarketRegisteredEvent {
  const event = newTypedMockEvent<MarketRegisteredEvent>();

  event.parameters.push(
    new ethereum.EventParam('market', ethereum.Value.fromAddress(Address.fromString(market)))
  );
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
