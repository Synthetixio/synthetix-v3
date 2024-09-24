import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleReferrerShareUpdated } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createReferrerShareUpdatedEvent } from './event-factories/createReferrerShareUpdatedEvent';

export default function test(): void {
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

  log.info('Should create a new ReferrerShare record', []);

  let referrer = '0x6900000000000000000000000000000000000000';
  let shareRatioD18 = 300;

  handleReferrerShareUpdated(
    createReferrerShareUpdatedEvent(referrer, shareRatioD18, timestamp, blockNumber, logIndex)
  );

  assert.entityCount('ReferrerShare', 1);

  assert.fieldEquals('ReferrerShare', referrer, 'referrer', referrer);
  assert.fieldEquals('ReferrerShare', referrer, 'shareRatioD18', shareRatioD18.toString());
}
