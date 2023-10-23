import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import {
  OrderSettled as OrderSettledEvent,
  OrderSettledFeesStruct,
} from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createOrderSettledEvent(
  marketId: i32,
  asyncOrderId: i64,
  finalOrderAmount: i64,
  // fees tuple
  fixedFees: i64,
  utilizationFees: i64,
  skewFees: i64,
  wrapperFees: i64,
  // end of fees tuple
  collectedFees: i64,
  settler: string,
  price: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): OrderSettledEvent {
  const event = newTypedMockEvent<OrderSettledEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam(
      'asyncOrderId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(asyncOrderId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'finalOrderAmount',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(finalOrderAmount))
    )
  );

  const fees = changetype<OrderSettledFeesStruct>([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(fixedFees)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(utilizationFees)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(skewFees)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(wrapperFees)),
  ]);
  event.parameters.push(new ethereum.EventParam('fees', ethereum.Value.fromTuple(fees)));

  event.parameters.push(
    new ethereum.EventParam(
      'collectedFees',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(collectedFees))
    )
  );
  event.parameters.push(
    new ethereum.EventParam('settler', ethereum.Value.fromAddress(Address.fromString(settler)))
  );
  event.parameters.push(
    new ethereum.EventParam('price', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(price)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
