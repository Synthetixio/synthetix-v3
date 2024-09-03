import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleMarketPriceDataUpdated } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createMarketPriceDataUpdatedEvent } from './event-factories/createMarketPriceDataUpdatedEvent';

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

  log.info('Should update the market feedId', []);

  const feedId = '0x4200000000000000000000000000000000000000';

  handleMarketPriceDataUpdated(
    createMarketPriceDataUpdatedEvent(perpsMarketId, feedId, timestamp, blockNumber, logIndex)
  );

  assert.entityCount('Market', 1);
  assert.fieldEquals('Market', perpsMarketId.toString(), 'feedId', feedId.toString());
}
