import { assert, log } from 'matchstick-as';
import { handleSynthPriceDataUpdated } from '../optimism-mainnet';
import { createSynthPriceDataUpdatedEvent } from './event-factories/createSynthPriceDataUpdatedEvent';

export default function test(): void {
  assert.entityCount('MarketInfo', 0);

  log.info('Should create a new MarketInfo for the event', []);
  const buyFeedId1 = '0x4200000000000000000000000000000000000000';
  const sellfeedId1 = '0x6900000000000000000000000000000000000000';
  handleSynthPriceDataUpdated(
    createSynthPriceDataUpdatedEvent(1, buyFeedId1, sellfeedId1, 10_000, 10, 1)
  );

  const id1 = '1';
  assert.entityCount('MarketInfo', 1);
  assert.fieldEquals('MarketInfo', id1, 'id', id1);
  assert.fieldEquals('MarketInfo', id1, 'marketId', '1');
  assert.fieldEquals('MarketInfo', id1, 'buyFeedId', buyFeedId1);
  assert.fieldEquals('MarketInfo', id1, 'sellFeedId', sellfeedId1);

  log.info('Should update existing MarketInfo for the event', []);
  const buyFeedId2 = '0x4200000000000000000000000000000000000069';
  const sellfeedId2 = '0x6900000000000000000000000000000000000069';
  handleSynthPriceDataUpdated(
    createSynthPriceDataUpdatedEvent(1, buyFeedId2, sellfeedId2, 20_000, 20, 2)
  );

  const id2 = '1';
  assert.entityCount('MarketInfo', 1);
  assert.fieldEquals('MarketInfo', id2, 'id', id2);
  assert.fieldEquals('MarketInfo', id2, 'marketId', '1');
  assert.fieldEquals('MarketInfo', id2, 'buyFeedId', buyFeedId2);
  assert.fieldEquals('MarketInfo', id2, 'sellFeedId', sellfeedId2);
}
