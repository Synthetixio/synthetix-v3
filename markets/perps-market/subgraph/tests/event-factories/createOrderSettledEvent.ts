import { BigInt, ethereum, Address, Bytes } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { OrderSettled as OrderSettledEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createOrderSettledEvent(
  marketId: i32,
  accountId: i32,
  fillPrice: i64,
  pnl: i64,
  accruedFunding: i64,
  sizeDelta: i64,
  newSize: i64,
  totalFees: i64,
  referralFees: i64,
  collectedFees: i64,
  settlementReward: i64,
  trackingCode: string,
  settler: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): OrderSettledEvent {
  const event = newTypedMockEvent<OrderSettledEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(new ethereum.EventParam('accountId', ethereum.Value.fromI32(accountId)));
  event.parameters.push(
    new ethereum.EventParam(
      'fillPrice',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(fillPrice))
    )
  );
  event.parameters.push(
    new ethereum.EventParam('pnl', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(pnl)))
  );
  event.parameters.push(
    new ethereum.EventParam(
      'accruedFunding',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accruedFunding))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'sizeDelta',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(sizeDelta))
    )
  );
  event.parameters.push(
    new ethereum.EventParam('newSize', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(newSize)))
  );
  event.parameters.push(
    new ethereum.EventParam(
      'totalFees',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(totalFees))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'referralFees',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(referralFees))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'collectedFees',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(collectedFees))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'settlementReward',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementReward))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'trackingCode',
      ethereum.Value.fromBytes(Bytes.fromHexString(trackingCode) as Bytes)
    )
  );
  event.parameters.push(
    new ethereum.EventParam('settler', ethereum.Value.fromAddress(Address.fromString(settler)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
