import { newTypedMockEvent } from 'matchstick-as';
import { MarketUsdDeposited } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createBlock } from './utils';

export function createMarketUsdDepositedEvent(
  marketId: i32,
  target: string,
  amount: i64,
  market: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32
): MarketUsdDeposited {
  const event = newTypedMockEvent<MarketUsdDeposited>();

  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam('target', ethereum.Value.fromAddress(Address.fromString(target)))
  );
  event.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  event.parameters.push(
    new ethereum.EventParam('market', ethereum.Value.fromAddress(Address.fromString(market)))
  );

  const block = createBlock(timestamp, blockNumber);
  event.block.timestamp = BigInt.fromI64(block['timestamp']);
  event.block.number = BigInt.fromI64(block['blockNumber']);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
