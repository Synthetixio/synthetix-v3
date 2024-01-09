import { BigInt, ethereum, Address, Bytes } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import {
  SettlementStrategyAdded as SettlementStrategyAddedEvent,
  SettlementStrategyAddedStrategyStruct,
} from '../../optimism-goerli/generated/PerpsMarketProxy/PerpsMarketProxy';

export function createSettlementStrategyAddedEvent(
  marketId: i32,
  // strategy struct
  strategyType: i32,
  settlementDelay: i64,
  settlementWindowDuration: i64,
  priceWindowDuration: i64,
  priceVerificationContract: string,
  feedId: string,
  url: string,
  settlementReward: i64,
  disabled: boolean,
  // end of strategy struct
  strategyId: i32,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): SettlementStrategyAddedEvent {
  const event = newTypedMockEvent<SettlementStrategyAddedEvent>();

  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));

  const strategy = changetype<SettlementStrategyAddedStrategyStruct>([
    ethereum.Value.fromI32(strategyType),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementDelay)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementWindowDuration)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(priceWindowDuration)),
    ethereum.Value.fromAddress(Address.fromString(priceVerificationContract)),
    ethereum.Value.fromBytes(Bytes.fromHexString(feedId) as Bytes),
    ethereum.Value.fromString(url),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementReward)),
    ethereum.Value.fromBoolean(disabled),
  ]);
  event.parameters.push(new ethereum.EventParam('strategy', ethereum.Value.fromTuple(strategy)));

  event.parameters.push(new ethereum.EventParam('strategyId', ethereum.Value.fromI32(strategyId)));

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
