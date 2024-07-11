import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { MarketRegistered } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { newTypedMockEvent } from 'matchstick-as';
import { createBlock } from './utils';

export function createMarketRegisteredEvent(
  market: string,
  marketId: i32,
  sender: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32
): MarketRegistered {
  const event = newTypedMockEvent<MarketRegistered>();
  const block = createBlock(timestamp, blockNumber);
  event.parameters.push(
    new ethereum.EventParam('market', ethereum.Value.fromAddress(Address.fromString(market)))
  );
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );

  event.block.timestamp = BigInt.fromI64(block['timestamp']);
  event.block.number = BigInt.fromI64(block['blockNumber']);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
