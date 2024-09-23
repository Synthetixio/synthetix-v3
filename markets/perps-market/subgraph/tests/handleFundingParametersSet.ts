import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleFundingParametersSet } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createFundingParametersSetEvent } from './event-factories/createFundingParametersSetEvent';

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

  log.info('Should update the market funding parameters', []);

  const skewScale = 10_000;
  const maxFundingVelocity = 20_000;

  handleFundingParametersSet(
    createFundingParametersSetEvent(
      perpsMarketId,
      skewScale,
      maxFundingVelocity,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.fieldEquals('Market', perpsMarketId.toString(), 'skewScale', skewScale.toString());
  assert.fieldEquals(
    'Market',
    perpsMarketId.toString(),
    'maxFundingVelocity',
    maxFundingVelocity.toString()
  );
}
