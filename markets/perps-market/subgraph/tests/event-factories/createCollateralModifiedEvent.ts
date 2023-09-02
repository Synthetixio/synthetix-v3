import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { CollateralModified as CollateralModifiedEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createCollateralModifiedEvent(
  id: i32,
  synthMarketId: i32,
  amountDelta: i64,
  sender: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): CollateralModifiedEvent {
  const event = newTypedMockEvent<CollateralModifiedEvent>();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('accountId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam('synthMarketId', ethereum.Value.fromI32(synthMarketId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      'amountDelta',
      ethereum.Value.fromSignedBigInt(BigInt.fromI64(amountDelta))
    )
  );
  event.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );
  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);
  return event;
}
