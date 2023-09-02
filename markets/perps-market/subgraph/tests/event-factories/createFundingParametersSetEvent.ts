import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { FundingParametersSet as FundingParametersSetEvent } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createFundingParametersSetEvent(
  id: i32,
  skewScale: i64,
  maxFundingVelocity: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): FundingParametersSetEvent {
  const event = newTypedMockEvent<FundingParametersSetEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam(
      'skewScale',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(skewScale))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'maxFundingVelocity',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(maxFundingVelocity))
    )
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
