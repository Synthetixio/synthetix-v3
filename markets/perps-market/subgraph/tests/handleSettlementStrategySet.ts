import { assert, log } from 'matchstick-as';
import {
  handleSettlementStrategyAdded,
  handleSettlementStrategySet,
} from '../base-mainnet-andromeda';
import { createSettlementStrategyAddedEvent } from './event-factories/createSettlementStrategyAddedEvent';
import { createSettlementStrategySetEvent } from './event-factories/createSettlementStrategySetEvent';

export default function test(): void {
  assert.entityCount('SettlementStrategy', 0);

  log.info('Should create a new record for the Settlement Strategy', []);

  // create a SettlementStrategy
  const marketId = 1;
  const strategyType = 1;
  const settlementDelay = 10_000;
  const settlementWindowDuration = 10_000;
  const priceVerificationContract = '0x4200000000000000000000000000000000000000';
  const feedId = '0x6900000000000000000000000000000000000000';
  const settlementReward = 10_000;
  const disabled = false;
  const commitmentPriceDelay = 2;
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
      priceVerificationContract,
      feedId,
      settlementReward,
      disabled,
      commitmentPriceDelay,
      strategyId,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('SettlementStrategy', 1);
  assert.fieldEquals('SettlementStrategy', '1-1', 'enabled', (!disabled).toString());

  log.info('Should disable the Settlement Strategy', []);

  handleSettlementStrategySet(
    createSettlementStrategySetEvent(
      marketId,
      strategyId,
      strategyType,
      settlementDelay,
      settlementWindowDuration,
      priceVerificationContract,
      feedId,
      settlementReward,
      true,
      strategyId,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('SettlementStrategy', 1);
  assert.fieldEquals('SettlementStrategy', '1-1', 'disabled', 'true');

  log.info(
    'Should skip even if Settlement Strategy does not exist and not add any more records',
    []
  );
  handleSettlementStrategySet(
    createSettlementStrategySetEvent(
      123123,
      2,
      strategyType,
      settlementDelay,
      settlementWindowDuration,
      priceVerificationContract,
      feedId,
      settlementReward,
      true,
      strategyId,
      timestamp,
      blockNumber,
      logIndex
    )
  );
  assert.entityCount('SettlementStrategy', 1);
}
