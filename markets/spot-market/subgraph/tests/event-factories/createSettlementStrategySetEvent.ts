import { BigInt, ethereum, Address, Bytes } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import {
  SettlementStrategySet as SettlementStrategySetEvent,
  SettlementStrategySetStrategyStruct,
} from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createSettlementStrategySetEvent(
  synthMarketId: i32,
  strategyId: i64,
  // strategy struct
  strategyType: i32,
  settlementDelay: i64,
  settlementWindowDuration: i64,
  priceVerificationContract: string,
  feedId: string,
  url: string,
  settlementReward: i64,
  priceDeviationTolerance: i64,
  minimumUsdExchangeAmount: i64,
  maxRoundingLoss: i64,
  disabled: boolean,
  // end of strategy struct
  timestamp: i64,
  blockNumber: i64,
  logIndex: i64
): SettlementStrategySetEvent {
  const event = newTypedMockEvent<SettlementStrategySetEvent>();

  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam('synthMarketId', ethereum.Value.fromI32(synthMarketId))
  );
  event.parameters.push(
    new ethereum.EventParam(
      'strategyId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(strategyId))
    )
  );
  const strategy = changetype<SettlementStrategySetStrategyStruct>([
    ethereum.Value.fromI32(strategyType),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementDelay)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementWindowDuration)),
    ethereum.Value.fromAddress(Address.fromString(priceVerificationContract)),
    ethereum.Value.fromBytes(Bytes.fromHexString(feedId) as Bytes),
    ethereum.Value.fromString(url),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(settlementReward)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(priceDeviationTolerance)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(minimumUsdExchangeAmount)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(maxRoundingLoss)),
    ethereum.Value.fromBoolean(disabled),
  ]);
  event.parameters.push(new ethereum.EventParam('strategy', ethereum.Value.fromTuple(strategy)));

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
