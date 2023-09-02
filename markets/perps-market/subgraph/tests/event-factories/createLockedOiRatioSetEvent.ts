import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { LockedOiRatioSet as LockedOiRatioSetEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createLockedOiRatioSetEvent(
  id: i32,
  lockedOiRatioD18: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): LockedOiRatioSetEvent {
  const event = newTypedMockEvent<LockedOiRatioSetEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam(
      'lockedOiRatioD18',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(lockedOiRatioD18))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
