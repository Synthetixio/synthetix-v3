import { BigInt, ethereum, Bytes } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { SynthPriceDataUpdated as SynthPriceDataUpdatedEvent } from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createSynthPriceDataUpdatedEvent(
  id: i32,
  buyFeedId: string,
  sellFeedId: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): SynthPriceDataUpdatedEvent {
  const event = newTypedMockEvent<SynthPriceDataUpdatedEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('synthMarketId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam('buyFeedId', ethereum.Value.fromBytes(Bytes.fromHexString(buyFeedId)))
  );
  event.parameters.push(
    new ethereum.EventParam('sellFeedId', ethereum.Value.fromBytes(Bytes.fromHexString(sellFeedId)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
