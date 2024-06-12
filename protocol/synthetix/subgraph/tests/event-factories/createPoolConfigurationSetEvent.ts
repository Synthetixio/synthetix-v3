import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PoolConfigurationSet } from '../../mainnet/generated/CoreProxy/CoreProxy';
import { createBlock } from './utils';
import { newTypedMockEvent } from 'matchstick-as';

export function createPoolConfigurationSetEvent(
  poolId: i32,
  marketConfigs: Array<ethereum.Tuple>,
  timestamp: i64,
  blockNumber: i64
): PoolConfigurationSet {
  const newMarketRegisteredEvent = newTypedMockEvent<PoolConfigurationSet>();
  const block = createBlock(timestamp, blockNumber);
  newMarketRegisteredEvent.parameters = [];
  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('markets', ethereum.Value.fromTupleArray(marketConfigs))
  );

  newMarketRegisteredEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newMarketRegisteredEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newMarketRegisteredEvent;
}
