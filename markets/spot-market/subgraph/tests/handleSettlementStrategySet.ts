import { assert, log } from 'matchstick-as';
import { handleSettlementStrategyAdded, handleSettlementStrategySet } from '../optimism-mainnet';
import { createSettlementStrategyAddedEvent } from './event-factories/createSettlementStrategyAddedEvent';
import { createSettlementStrategySetEvent } from './event-factories/createSettlementStrategySetEvent';

export default function test(): void {
  assert.entityCount('SettlementStrategy', 0);
  let synthMarketId = 1;
  let strategyId = 100001;

  let strategyType = 2;
  let settlementDelay = 100;
  let settlementWindowDuration = 200;
  let priceVerificationContract = '0x4200000000000000000000000000000000000000';
  let feedId = '0x6900000000000000000000000000000000000000';
  let url = 'https://example.com';
  let settlementReward = 10_000;
  let priceDeviationTolerance = 400;
  let minimumUsdExchangeAmount = 500;
  let maxRoundingLoss = 600;
  let disabled = false;

  let timestamp = 1_000_000;
  let blockNumber = 1;
  let logIndex = 1;

  log.info('Should create a new SettlementStrategy record for testing', []);
  handleSettlementStrategyAdded(
    createSettlementStrategyAddedEvent(synthMarketId, strategyId, timestamp, blockNumber, logIndex)
  );
  assert.entityCount('SettlementStrategy', 1);
  assert.fieldEquals('SettlementStrategy', strategyId.toString(), 'disabled', 'true');

  log.info('Should not create non-existent SettlementStrategy record', []);

  handleSettlementStrategySet(
    createSettlementStrategySetEvent(
      synthMarketId + 1,
      strategyId + 1,

      strategyType,
      settlementDelay,
      settlementWindowDuration,
      priceVerificationContract,
      feedId,
      url,
      settlementReward,
      priceDeviationTolerance,
      minimumUsdExchangeAmount,
      maxRoundingLoss,
      disabled,

      timestamp + 10_000,
      blockNumber + 1,
      logIndex + 1
    )
  );
  assert.entityCount('SettlementStrategy', 1);

  log.info('Should update an existing SettlementStrategy record', []);

  handleSettlementStrategySet(
    createSettlementStrategySetEvent(
      synthMarketId,
      strategyId,

      strategyType,
      settlementDelay,
      settlementWindowDuration,
      priceVerificationContract,
      feedId,
      url,
      settlementReward,
      priceDeviationTolerance,
      minimumUsdExchangeAmount,
      maxRoundingLoss,
      disabled,

      timestamp + 10_000,
      blockNumber + 1,
      logIndex + 1
    )
  );
  assert.entityCount('SettlementStrategy', 1);

  assert.fieldEquals('SettlementStrategy', strategyId.toString(), 'disabled', 'false');
}
