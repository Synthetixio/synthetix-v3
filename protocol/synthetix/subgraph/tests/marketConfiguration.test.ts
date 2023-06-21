import { test, assert, clearStore, describe, beforeEach } from 'matchstick-as';
import { ethereum, store } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import { handlePoolConfigurationSet, handlePoolCreated } from '../src/core';
import {
  createMarketCreatedEvent,
  createPoolConfigurationSetEvent,
  createPoolCreatedEvent,
} from './event-factories';
import { handleMarketCreated } from '../src/market';

describe('MarketConfiguration', () => {
  beforeEach(() => {
    clearStore();
  });
  test('handlePoolConfigurationSet', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
    const newMarketRegisteredEvent = createMarketCreatedEvent(1, address, now + 1000, now);
    const newMarketRegisteredEvent2 = createMarketCreatedEvent(2, address2, now + 2000, now + 1000);
    const markets = changetype<Array<ethereum.Tuple>>([
      changetype<Array<ethereum.Tuple>>([
        ethereum.Value.fromI32(1),
        ethereum.Value.fromI32(32),
        ethereum.Value.fromI32(812739821),
      ]),
      changetype<Array<ethereum.Tuple>>([
        ethereum.Value.fromI32(2),
        ethereum.Value.fromI32(43),
        ethereum.Value.fromI32(892379812),
      ]),
    ]);

    const newPoolConfigurationSetEvent = createPoolConfigurationSetEvent(
      1,
      markets,
      now + 3000,
      now + 2000
    );
    const secondMarkets = changetype<Array<ethereum.Tuple>>([
      changetype<Array<ethereum.Tuple>>([
        ethereum.Value.fromI32(2),
        ethereum.Value.fromI32(32),
        ethereum.Value.fromI32(812739821),
      ]),
    ]);
    const secondNewPoolConfigurationSetEvent = createPoolConfigurationSetEvent(
      1,
      secondMarkets,
      now + 4000,
      now + 3000
    );
    handlePoolCreated(newPoolEvent);
    handleMarketCreated(newMarketRegisteredEvent);
    handleMarketCreated(newMarketRegisteredEvent2);
    handlePoolConfigurationSet(newPoolConfigurationSetEvent);

    assert.fieldEquals('Pool', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'total_weight', '75');
    assert.fieldEquals('Pool', '1', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at_block', (now + 2000).toString());
    assert.fieldEquals('Pool', '1', 'market_ids', '[1, 2]');
    assert.fieldEquals('Pool', '1', 'total_weight', '75');
    assert.assertNull(store.get('Pool', '1')!.get('name'));
    assert.notInStore('Pool', '2');
    assert.fieldEquals('Market', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'market_ids', '[1, 2]');

    // Assert market doesn't get updated by configuration event
    assert.fieldEquals('Market', '1', 'created_at', (now + 1000).toString());
    assert.fieldEquals('Market', '1', 'created_at_block', now.toString());
    // The market itself will not receive any updates, only the MarketConfiguration and the Pool
    assert.fieldEquals('Market', '1', 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Market', '1', 'updated_at_block', now.toString());
    assert.fieldEquals('Market', '2', 'id', '2');
    assert.fieldEquals('Market', '2', 'created_at', (now + 2000).toString());
    assert.fieldEquals('Market', '2', 'created_at_block', (now + 1000).toString());
    assert.fieldEquals('Market', '2', 'updated_at', (now + 2000).toString());
    assert.fieldEquals('Market', '2', 'updated_at_block', (now + 1000).toString());
    assert.notInStore('Market', '3');

    // Assert market configuration
    assert.fieldEquals('MarketConfiguration', '1-1', 'id', '1-1');
    assert.fieldEquals('MarketConfiguration', '1-1', 'pool', '1');
    assert.fieldEquals('MarketConfiguration', '1-1', 'max_debt_share_value', '812739821');
    assert.fieldEquals('MarketConfiguration', '1-1', 'updated_at_block', (now + 2000).toString());
    assert.fieldEquals('MarketConfiguration', '1-1', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('MarketConfiguration', '1-1', 'created_at', (now + 3000).toString());
    assert.fieldEquals('MarketConfiguration', '1-1', 'created_at_block', (now + 2000).toString());
    assert.fieldEquals('MarketConfiguration', '1-1', 'market', '1');
    assert.fieldEquals('MarketConfiguration', '1-2', 'id', '1-2');
    assert.fieldEquals('MarketConfiguration', '1-2', 'market', '2');
    assert.fieldEquals('MarketConfiguration', '1-2', 'pool', '1');
    assert.fieldEquals('MarketConfiguration', '1-2', 'max_debt_share_value', '892379812');
    assert.fieldEquals('MarketConfiguration', '1-2', 'created_at', (now + 3000).toString());
    assert.fieldEquals('MarketConfiguration', '1-2', 'created_at_block', (now + 2000).toString());
    assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at_block', (now + 2000).toString());

    // Fire second event that should update Pool and MarketConfiguration.  Removed MarketConfigurations should also be deleted
    handlePoolConfigurationSet(secondNewPoolConfigurationSetEvent);

    assert.notInStore('MarketConfiguration', '1-1');
    assert.fieldEquals('Pool', '1', 'total_weight', '32');
    assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at', (now + 4000).toString());
    assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at_block', (now + 3000).toString());
    assert.notInStore('Pool', '2');
  });
});
