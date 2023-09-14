import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { AccountLiquidated } from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createAccountLiquidatedEvent(
  id: i32,
  reward: i64,
  fullLiquidation: boolean,
  timestamp: i64,
  blockNumber: i64
): AccountLiquidated {
  const event = newTypedMockEvent<AccountLiquidated>();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('accountId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam('reward', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(reward)))
  );
  event.parameters.push(
    new ethereum.EventParam('fullLiquidation', ethereum.Value.fromBoolean(fullLiquidation))
  );
  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  return event;
}
