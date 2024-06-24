import { assert } from 'matchstick-as';
import { ethereum, store } from '@graphprotocol/graph-ts';
import { handleMarketCreated, handlePoolConfigurationSet, handlePoolCreated } from '../mainnet';
import {
  createPoolConfigurationSetEvent,
  createPoolCreatedEvent,
  createMarketRegisteredEvent,
} from './event-factories';

export default function test(): void {
  const sender = '0x6942000000000000000000000000000000000000';
  const marketId1 = 1;
  const marketId2 = 2;
  const market1 = '0x6900000000000000000000000000000000000000';
  const market2 = '0x4200000000000000000000000000000000000000';
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;
  handleMarketCreated(
    createMarketRegisteredEvent(market1, marketId1, sender, timestamp, blockNumber, logIndex)
  );
  handleMarketCreated(
    createMarketRegisteredEvent(market2, marketId2, sender, timestamp, blockNumber, logIndex)
  );

  handlePoolCreated(createPoolCreatedEvent(1, sender, timestamp, timestamp - 1000));

  handlePoolConfigurationSet(
    createPoolConfigurationSetEvent(
      1,
      changetype<Array<ethereum.Tuple>>([
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
      ]),
      timestamp + 3000,
      timestamp + 2000
    )
  );

  assert.entityCount('Pool', 1);
  assert.entityCount('Market', 2);
  assert.entityCount('MarketConfiguration', 2);

  assert.fieldEquals('Pool', '1', 'id', '1');
  assert.fieldEquals('Pool', '1', 'total_weight', '75');
  assert.fieldEquals('Pool', '1', 'updated_at', (timestamp + 3000).toString());
  assert.fieldEquals('Pool', '1', 'updated_at_block', (timestamp + 2000).toString());
  assert.fieldEquals('Pool', '1', 'market_ids', '[1, 2]');
  assert.fieldEquals('Pool', '1', 'total_weight', '75');
  assert.assertNull(store.get('Pool', '1')!.get('name'));
  assert.fieldEquals('Pool', '1', 'market_ids', '[1, 2]');

  // Assert market doesn't get updated by configuration event
  assert.fieldEquals('Market', '1', 'id', '1');
  assert.fieldEquals('Market', '1', 'created_at', `${timestamp}`);
  // The market itself will not receive any updates, only the MarketConfiguration and the Pool
  assert.fieldEquals('Market', '1', 'updated_at', `${timestamp}`);

  assert.fieldEquals('Market', '2', 'id', '2');
  assert.fieldEquals('Market', '2', 'created_at', `${timestamp}`);
  assert.fieldEquals('Market', '2', 'updated_at', `${timestamp}`);

  // Assert market configuration
  assert.fieldEquals('MarketConfiguration', '1-1', 'id', '1-1');
  assert.fieldEquals('MarketConfiguration', '1-1', 'pool', '1');
  assert.fieldEquals('MarketConfiguration', '1-1', 'max_debt_share_value', '812739821');
  assert.fieldEquals(
    'MarketConfiguration',
    '1-1',
    'updated_at_block',
    (timestamp + 2000).toString()
  );
  assert.fieldEquals('MarketConfiguration', '1-1', 'updated_at', (timestamp + 3000).toString());
  assert.fieldEquals('MarketConfiguration', '1-1', 'created_at', (timestamp + 3000).toString());
  assert.fieldEquals(
    'MarketConfiguration',
    '1-1',
    'created_at_block',
    (timestamp + 2000).toString()
  );
  assert.fieldEquals('MarketConfiguration', '1-1', 'market', '1');
  assert.fieldEquals('MarketConfiguration', '1-2', 'id', '1-2');
  assert.fieldEquals('MarketConfiguration', '1-2', 'market', '2');
  assert.fieldEquals('MarketConfiguration', '1-2', 'pool', '1');
  assert.fieldEquals('MarketConfiguration', '1-2', 'max_debt_share_value', '892379812');
  assert.fieldEquals('MarketConfiguration', '1-2', 'created_at', (timestamp + 3000).toString());
  assert.fieldEquals(
    'MarketConfiguration',
    '1-2',
    'created_at_block',
    (timestamp + 2000).toString()
  );
  assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at', (timestamp + 3000).toString());
  assert.fieldEquals(
    'MarketConfiguration',
    '1-2',
    'updated_at_block',
    (timestamp + 2000).toString()
  );

  // Fire second event that should update Pool and MarketConfiguration.  Removed MarketConfigurations should also be deleted
  handlePoolConfigurationSet(
    createPoolConfigurationSetEvent(
      1,
      changetype<Array<ethereum.Tuple>>([
        changetype<Array<ethereum.Tuple>>([
          ethereum.Value.fromI32(2),
          ethereum.Value.fromI32(32),
          ethereum.Value.fromI32(812739821),
        ]),
      ]),
      timestamp + 4000,
      timestamp + 3000
    )
  );

  assert.fieldEquals('Pool', '1', 'total_weight', '32');
  assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at', (timestamp + 4000).toString());
  assert.fieldEquals(
    'MarketConfiguration',
    '1-2',
    'updated_at_block',
    (timestamp + 3000).toString()
  );
}
