import { assert, log } from 'matchstick-as';
import {
  handleSettlementStrategyAdded,
  handleSettlementStrategyUpdated,
} from '../optimism-mainnet';
import { createSettlementStrategyAddedEvent } from './event-factories/createSettlementStrategyAddedEvent';
import { createSettlementStrategyUpdatedEvent } from './event-factories/createSettlementStrategyUpdatedEvent';

export default function test(): void {
  assert.entityCount('SettlementStrategy', 0);
  let synthMarketId = 1;
  let strategyId = 100001;
  let timestamp = 1_000_000;
  let blockNumber = 1;
  let logIndex = 1;

  log.info('Should create a new SettlementStrategy record for testing', []);
  handleSettlementStrategyAdded(
    createSettlementStrategyAddedEvent(synthMarketId, strategyId, timestamp, blockNumber, logIndex)
  );
  assert.entityCount('SettlementStrategy', 1);

  log.info('Should not create non-existent SettlementStrategy record', []);

  handleSettlementStrategyUpdated(
    createSettlementStrategyUpdatedEvent(
      synthMarketId + 1,
      strategyId + 1,
      false,
      timestamp + 10_000,
      blockNumber + 1,
      logIndex + 1
    )
  );
  assert.entityCount('SettlementStrategy', 1);

  assert.fieldEquals('SettlementStrategy', strategyId.toString(), 'disabled', 'false');

  log.info('Should update an existing SettlementStrategy record', []);

  handleSettlementStrategyUpdated(
    createSettlementStrategyUpdatedEvent(
      synthMarketId,
      strategyId,
      false,
      timestamp + 10_000,
      blockNumber + 1,
      logIndex + 1
    )
  );
  assert.entityCount('SettlementStrategy', 1);

  assert.fieldEquals('SettlementStrategy', strategyId.toString(), 'disabled', 'true');
}
