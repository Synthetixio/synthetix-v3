import { BigInt, ethereum, Address } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { MaxLiquidationParametersSet as MaxLiquidationParametersSetEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createMaxLiquidationParametersSetEvent(
  marketId: i32,
  maxLiquidationLimitAccumulationMultiplier: i64,
  maxSecondsInLiquidationWindow: i64,
  maxLiquidationPd: i64,
  endorsedLiquidator: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): MaxLiquidationParametersSetEvent {
  const event = newTypedMockEvent<MaxLiquidationParametersSetEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam(
      'maxLiquidationLimitAccumulationMultiplier',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(maxLiquidationLimitAccumulationMultiplier))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'maxSecondsInLiquidationWindow',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(maxSecondsInLiquidationWindow))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'maxLiquidationPd',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(maxLiquidationPd))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'endorsedLiquidator',
      ethereum.Value.fromAddress(Address.fromString(endorsedLiquidator))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
