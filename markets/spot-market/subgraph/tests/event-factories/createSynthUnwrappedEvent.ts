import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import {
  SynthUnwrapped as SynthUnwrappedEvent,
  SynthUnwrappedFeesStruct,
} from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createSynthUnwrappedEvent(
  id: i32,
  amountUnwrapped: i64,
  // fees tuple
  fixedFees: i64,
  utilizationFees: i64,
  skewFees: i64,
  wrapperFees: i64,
  // end of fees tuple
  feesCollected: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): SynthUnwrappedEvent {
  const event = newTypedMockEvent<SynthUnwrappedEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('synthMarketId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam(
      'amountUnwrapped',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amountUnwrapped))
    )
  );

  const fees = changetype<SynthUnwrappedFeesStruct>([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(fixedFees)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(utilizationFees)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(skewFees)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(wrapperFees)),
  ]);
  event.parameters.push(new ethereum.EventParam('fees', ethereum.Value.fromTuple(fees)));

  event.parameters.push(
    new ethereum.EventParam(
      'feesCollected',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(feesCollected))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);
  return event;
}
