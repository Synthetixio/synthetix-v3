import { assert, log } from 'matchstick-as';
import { handleSettlementStrategyAdded } from '../optimism-mainnet';
import { createSettlementStrategyAddedEvent } from './event-factories/createSettlementStrategyAddedEvent';

export default function test(): void {
  assert.entityCount('SettlementStrategy', 0);

  let synthMarketId = 1;
  let strategyId = 100001;
  let timestamp = 1_000_000;
  let blockNumber = 1;
  let logIndex = 1;

  log.info('Should create a new SettlementStrategy record', []);
  handleSettlementStrategyAdded(
    createSettlementStrategyAddedEvent(synthMarketId, strategyId, timestamp, blockNumber, logIndex)
  );

  assert.entityCount('SettlementStrategy', 1);
  let addedStrategyId = strategyId.toString();

  assert.fieldEquals('SettlementStrategy', addedStrategyId, 'marketId', synthMarketId.toString());
  assert.fieldEquals(
    'SettlementStrategy',
    addedStrategyId,
    'settlementStrategyId',
    strategyId.toString()
  );
}
