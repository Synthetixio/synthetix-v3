import { PoolConfigurationSet } from '../generated/CoreProxy/CoreProxy';
import { MarketConfiguration, Pool } from '../generated/schema';
import { BigDecimal, BigInt, log, store } from '@graphprotocol/graph-ts';

const getMarketConfigurationForPoolByMarketId = (pool: Pool): Map<string, string> => {
  const poolMarketIds = pool.market_ids;

  let marketIdByMarketId = new Map<string, string>();
  if (poolMarketIds === null) return marketIdByMarketId;
  for (let i = 0; i < poolMarketIds.length; ++i) {
    const marketId = poolMarketIds.at(i);
    marketIdByMarketId.set(marketId, marketId);
  }
  return marketIdByMarketId;
};
const deleteRemovedMarketConfigurations = (
  event: PoolConfigurationSet,
  currentMarketIdsInPoolByMarketId: Map<string, string>
): void => {
  if (currentMarketIdsInPoolByMarketId.size === 0) {
    // no current market set on pool, so nothing to remove
    return;
  }
  const marketsFromEventExistsById = new Map<string, boolean>();
  for (let i = 0; i < event.params.markets.length; ++i) {
    const market = event.params.markets.at(i);
    marketsFromEventExistsById.set(market.marketId.toString(), true);
  }

  const currentMarketConfigs = currentMarketIdsInPoolByMarketId.values();

  // The event.markets is the source of truth of what markets is connected to the pool
  // If we currently have a market configuration that shouldn't be there, remove that entity.
  for (let i = 0; i < currentMarketConfigs.length; ++i) {
    const marketId = currentMarketConfigs.at(i);
    const marketConfigShouldBeRemoved = !marketsFromEventExistsById.has(marketId);
    if (marketConfigShouldBeRemoved) {
      const marketConfigurationId = event.params.poolId.toString().concat('-').concat(marketId);
      store.remove('MarketConfiguration', marketConfigurationId);
    }
  }
};

const updateMarketConfiguration = (
  marketConfigId: string,
  newWeight: BigInt,
  newMaxDebtShareValue: BigDecimal,
  blockTimestamp: BigInt,
  blockNumber: BigInt
): void => {
  const marketConfig = MarketConfiguration.load(marketConfigId);
  if (!marketConfig) {
    log.error('Expected market id to exists', []);
    return;
  }
  const oldWeight = marketConfig.weight;
  const oldMaxDebtShareValue = marketConfig.max_debt_share_value;
  if (oldWeight === newWeight && oldMaxDebtShareValue === newMaxDebtShareValue) {
    // No values need to be updated
    return;
  }
  marketConfig.weight = newWeight;
  marketConfig.max_debt_share_value = newMaxDebtShareValue;
  marketConfig.updated_at = blockTimestamp;
  marketConfig.updated_at_block = blockNumber;
  marketConfig.save();
};
const updateExistingMarketConfigurations = (
  event: PoolConfigurationSet,
  currentMarketIdsInPoolByMarketId: Map<string, string>
): void => {
  if (currentMarketIdsInPoolByMarketId.size === 0) {
    // no current market set on pool, so nothing to update
    return;
  }

  for (let i = 0; i < event.params.markets.length; ++i) {
    const newMaxDebtShareValue = event.params.markets.at(i).maxDebtShareValueD18.toBigDecimal();
    const marketId = event.params.markets.at(i).marketId.toString();
    if (currentMarketIdsInPoolByMarketId.has(marketId)) {
      const newWeight = event.params.markets.at(i).weightD18;
      const blockTimestamp = event.block.timestamp;
      const blockNumber = event.block.number;
      const marketConfigId = event.params.poolId.toString().concat('-').concat(marketId);
      updateMarketConfiguration(
        marketConfigId,
        newWeight,
        newMaxDebtShareValue,
        blockTimestamp,
        blockNumber
      );
    }
  }
};

const createNewMarketConfigurations = (
  event: PoolConfigurationSet,
  currentMarketIdsInPoolByMarketId: Map<string, string>
): void => {
  const poolId = event.params.poolId.toString();
  for (let i = 0; i < event.params.markets.length; ++i) {
    const marketId = event.params.markets.at(i).marketId.toString();
    if (!currentMarketIdsInPoolByMarketId.has(marketId)) {
      const marketConfiguration = new MarketConfiguration(poolId.concat('-').concat(marketId));
      marketConfiguration.market = marketId;
      marketConfiguration.pool = poolId;
      marketConfiguration.created_at = event.block.timestamp;
      marketConfiguration.created_at_block = event.block.number;
      marketConfiguration.updated_at = event.block.timestamp;
      marketConfiguration.updated_at_block = event.block.number;
      marketConfiguration.weight = event.params.markets.at(i).weightD18;
      marketConfiguration.max_debt_share_value = event.params.markets
        .at(i)
        .maxDebtShareValueD18.toBigDecimal();

      marketConfiguration.save();
    }
  }
};

const updatePoolFields = (event: PoolConfigurationSet, pool: Pool): void => {
  const newTotalWeight = event.params.markets.reduce((sum, x) => {
    return sum.plus(x.weightD18);
  }, new BigInt(0));
  const marketIds = event.params.markets.map<string>((x) => x.marketId.toString());
  pool.total_weight = newTotalWeight;
  pool.updated_at = event.block.timestamp;
  pool.updated_at_block = event.block.number;
  pool.market_ids = marketIds;
  pool.save();
};

export function handlePoolConfigurationSet(event: PoolConfigurationSet): void {
  const poolId = event.params.poolId.toString();
  const pool = Pool.load(poolId);
  // Pool will be never undefined, though for safety reasons we are checking for that
  if (pool === null) {
    log.error('Pool id: ' + poolId + ' does not exist', []);
    return;
  }
  const currentMarketIdsInPoolByMarketId = getMarketConfigurationForPoolByMarketId(pool);
  // Mutative
  deleteRemovedMarketConfigurations(event, currentMarketIdsInPoolByMarketId);
  updateExistingMarketConfigurations(event, currentMarketIdsInPoolByMarketId);
  createNewMarketConfigurations(event, currentMarketIdsInPoolByMarketId);
  updatePoolFields(event, pool);
}
