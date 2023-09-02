import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { PositionLiquidated as PositionLiquidatedEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createPositionLiquidatedEvent(
  accountId: i32,
  marketId: i32,
  amountLiquidated: i64,
  currentPositionSize: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): PositionLiquidatedEvent {
  const event = newTypedMockEvent<PositionLiquidatedEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('accountId', ethereum.Value.fromI32(accountId)));
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam(
      'amountLiquidated',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amountLiquidated))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'currentPositionSize',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(currentPositionSize))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
