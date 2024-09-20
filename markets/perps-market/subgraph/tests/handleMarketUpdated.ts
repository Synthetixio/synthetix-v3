import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleMarketUpdated } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createMarketUpdatedEvent } from './event-factories/createMarketUpdatedEvent';

export default function test(): void {
  assert.entityCount('Market', 0);
  assert.entityCount('MarketUpdated', 0);

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
  assert.fieldEquals('Market', perpsMarketId.toString(), 'perpsMarketId', perpsMarketId.toString());

  log.info('Should update existing Market record', []);

  const price = 100;
  const skew = 200;
  const size = 300;
  const sizeDelta = 400;
  const currentFundingRate = 500;
  const currentFundingVelocity = 600;

  handleMarketUpdated(
    createMarketUpdatedEvent(
      perpsMarketId,
      price,
      skew,
      size,
      sizeDelta,
      currentFundingRate,
      currentFundingVelocity,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);

  assert.fieldEquals('Market', perpsMarketId.toString(), 'price', price.toString());
  assert.fieldEquals('Market', perpsMarketId.toString(), 'skew', skew.toString());
  assert.fieldEquals('Market', perpsMarketId.toString(), 'size', size.toString());
  assert.fieldEquals('Market', perpsMarketId.toString(), 'sizeDelta', sizeDelta.toString());
  assert.fieldEquals(
    'Market',
    perpsMarketId.toString(),
    'currentFundingRate',
    currentFundingRate.toString()
  );
  assert.fieldEquals(
    'Market',
    perpsMarketId.toString(),
    'currentFundingVelocity',
    currentFundingVelocity.toString()
  );

  assert.entityCount('MarketUpdated', 1);
  const marketUpdatedId =
    perpsMarketId.toString() + '-' + blockNumber.toString() + '-' + logIndex.toString();
  assert.fieldEquals('MarketUpdated', marketUpdatedId, 'price', price.toString());
  assert.fieldEquals('MarketUpdated', marketUpdatedId, 'skew', skew.toString());
  assert.fieldEquals('MarketUpdated', marketUpdatedId, 'size', size.toString());
  assert.fieldEquals('MarketUpdated', marketUpdatedId, 'sizeDelta', sizeDelta.toString());
  assert.fieldEquals(
    'MarketUpdated',
    marketUpdatedId,
    'currentFundingRate',
    currentFundingRate.toString()
  );
  assert.fieldEquals(
    'MarketUpdated',
    marketUpdatedId,
    'currentFundingVelocity',
    currentFundingVelocity.toString()
  );
}
