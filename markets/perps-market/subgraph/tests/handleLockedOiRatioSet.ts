import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleLockedOiRatioSet } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createLockedOiRatioSetEvent } from './event-factories/createLockedOiRatioSetEvent';

export default function test(): void {
  assert.entityCount('Market', 0);

  const perpsMarketId = 1;
  const marketName = 'Test Market';
  const marketSymbol = 'TM';
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;

  handleMarketCreated(
    createMarketCreatedEvent(
      perpsMarketId,
      marketName,
      marketSymbol,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);

  log.info('Should update lockedOiPercent for existing Market', []);

  const lockedOiRatioD18 = 10_000;

  handleLockedOiRatioSet(
    createLockedOiRatioSetEvent(perpsMarketId, lockedOiRatioD18, timestamp, blockNumber, logIndex)
  );

  assert.entityCount('Market', 1);
  assert.fieldEquals(
    'Market',
    perpsMarketId.toString(),
    'lockedOiPercent',
    lockedOiRatioD18.toString()
  );
}
