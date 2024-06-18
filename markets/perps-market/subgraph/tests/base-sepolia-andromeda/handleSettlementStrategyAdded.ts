import { assert, log } from 'matchstick-as';
import { handleSettlementStrategyAdded } from '../../base-sepolia-andromeda';
import { createSettlementStrategyAddedEvent } from './event-factories/createSettlementStrategyAddedEvent';

export default function test(): void {
  assert.entityCount('SettlementStrategy', 0);

  log.info('Should create a new record for the SettlementStrategy', []);

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
  assert.fieldEquals('SettlementStrategy', '1-1', 'id', '1-1');
  assert.fieldEquals('SettlementStrategy', '1-1', 'strategyId', '1');
  assert.fieldEquals('SettlementStrategy', '1-1', 'marketId', '1');
  assert.fieldEquals('SettlementStrategy', '1-1', 'strategyType', strategyType.toString());
  assert.fieldEquals('SettlementStrategy', '1-1', 'settlementDelay', settlementDelay.toString());
  assert.fieldEquals(
    'SettlementStrategy',
    '1-1',
    'settlementWindowDuration',
    settlementWindowDuration.toString()
  );
  assert.fieldEquals(
    'SettlementStrategy',
    '1-1',
    'priceVerificationContract',
    priceVerificationContract.toString()
  );
  assert.fieldEquals('SettlementStrategy', '1-1', 'feedId', feedId.toString());
  assert.fieldEquals('SettlementStrategy', '1-1', 'settlementReward', settlementReward.toString());
  assert.fieldEquals('SettlementStrategy', '1-1', 'enabled', (!disabled).toString());
  assert.fieldEquals(
    'SettlementStrategy',
    '1-1',
    'commitmentPriceDelay',
    commitmentPriceDelay.toString()
  );
}
