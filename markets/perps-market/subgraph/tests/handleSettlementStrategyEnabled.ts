import { assert, log } from 'matchstick-as';
import { handleSettlementStrategyAdded, handleSettlementStrategyEnabled } from '../optimism-goerli';
import { createSettlementStrategyAddedEvent } from './event-factories/createSettlementStrategyAddedEvent';
import { createSettlementStrategyEnabledEvent } from './event-factories/createSettlementStrategyEnabledEvent';

export default function test(): void {
  assert.entityCount('SettlementStrategy', 0);

  log.info('Should create a new record for the Settlement Strategy', []);

  // create a SettlementStrategy
  const marketId = 1;
  const strategyType = 1;
  const settlementDelay = 10_000;
  const settlementWindowDuration = 10_000;
  const priceWindowDuration = 10_000;
  const priceVerificationContract = '0x4200000000000000000000000000000000000000';
  const feedId = '0x6900000000000000000000000000000000000000';
  const url = 'https://example.com';
  const settlementReward = 10_000;
  const disabled = false;
  const strategyId = 1;
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;

  handleSettlementStrategyAdded(
    createSettlementStrategyAddedEvent(
      marketId,
      strategyType,
      settlementDelay,
      settlementWindowDuration,
      priceWindowDuration,
      priceVerificationContract,
      feedId,
      url,
      settlementReward,
      disabled,
      strategyId,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('SettlementStrategy', 1);
  assert.fieldEquals('SettlementStrategy', '1-1', 'enabled', (!disabled).toString());

  log.info('Should disable the Settlement Strategy', []);

  handleSettlementStrategyEnabled(
    createSettlementStrategyEnabledEvent(
      marketId,
      strategyId,
      false,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('SettlementStrategy', 1);
  assert.fieldEquals('SettlementStrategy', '1-1', 'enabled', 'false');

  log.info(
    'Should skip even if Settlement Strategy does not exist and not add any more records',
    []
  );
  handleSettlementStrategyEnabled(
    createSettlementStrategyEnabledEvent(marketId, 123123, false, timestamp, blockNumber, logIndex)
  );
  assert.entityCount('SettlementStrategy', 1);
}
