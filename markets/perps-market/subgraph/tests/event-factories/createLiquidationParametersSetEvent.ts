import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { LiquidationParametersSet as LiquidationParametersSetEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createLiquidationParametersSetEvent(
  id: i32,
  initialMarginRatioD18: i64,
  maintenanceMarginRatioD18: i64,
  minimumInitialMarginRatioD18: i64,
  liquidationRewardRatioD18: i64,
  minimumPositionMargin: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): LiquidationParametersSetEvent {
  const event = newTypedMockEvent<LiquidationParametersSetEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam(
      'initialMarginRatioD18',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(initialMarginRatioD18))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'maintenanceMarginRatioD18',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(maintenanceMarginRatioD18))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'minimumInitialMarginRatioD18',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(minimumInitialMarginRatioD18))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'liquidationRewardRatioD18',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(liquidationRewardRatioD18))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'minimumPositionMargin',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(minimumPositionMargin))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
