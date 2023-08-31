import { BigInt, ethereum, Bytes } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as';
import { PreviousOrderExpired as PreviousOrderExpiredEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createPreviousOrderExpiredEvent(
  marketId: i32,
  accountId: i32,
  sizeDelta: i64,
  acceptablePrice: i64,
  settlementTime: i64,
  trackingCode: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): PreviousOrderExpiredEvent {
  const event = changetype<PreviousOrderExpiredEvent>(newMockEvent());

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(new ethereum.EventParam('accountId', ethereum.Value.fromI32(accountId)));
  event.parameters.push(
    new ethereum.EventParam(
      'sizeDelta',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(sizeDelta))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'acceptablePrice',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(acceptablePrice))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'settlementTime',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementTime))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'trackingCode',
      ethereum.Value.fromBytes(Bytes.fromHexString(trackingCode) as Bytes)
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
