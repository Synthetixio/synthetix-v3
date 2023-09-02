import { BigInt, ethereum, Address } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { ReferrerShareUpdated as ReferrerShareUpdatedEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createReferrerShareUpdatedEvent(
  referrer: string,
  shareRatioD18: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): ReferrerShareUpdatedEvent {
  const event = newTypedMockEvent<ReferrerShareUpdatedEvent>();

  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam('referrer', ethereum.Value.fromAddress(Address.fromString(referrer)))
  );
  event.parameters.push(
    new ethereum.EventParam(
      'shareRatioD18',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(shareRatioD18))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
