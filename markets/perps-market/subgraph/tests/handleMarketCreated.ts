import { assert, log } from 'matchstick-as';
import { handleMarketCreated } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';

export default function test(): void {
  assert.entityCount('Market', 0);

  log.info('Should create a new record for the Market', []);

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
  assert.fieldEquals('Market', perpsMarketId.toString(), 'id', perpsMarketId.toString());
  assert.fieldEquals('Market', perpsMarketId.toString(), 'perpsMarketId', perpsMarketId.toString());
  assert.fieldEquals('Market', perpsMarketId.toString(), 'marketName', marketName);
  assert.fieldEquals('Market', perpsMarketId.toString(), 'marketSymbol', marketSymbol);
}
