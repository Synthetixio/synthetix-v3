import { assert, log } from 'matchstick-as';
import { handleMarketCreated } from '../mainnet';
import { createMarketRegisteredEvent } from './event-factories';

export default function test(): void {
  assert.entityCount('Market', 0);

  const sender = '0x6942000000000000000000000000000000000000';
  const marketId = 1;
  const market = '0x6900000000000000000000000000000000000000';
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;

  log.info('Should create a new Market record', []);

  handleMarketCreated(
    createMarketRegisteredEvent(market, marketId, sender, timestamp, blockNumber, logIndex)
  );

  assert.entityCount('Market', 1);

  assert.fieldEquals('Market', '1', 'id', marketId.toString());
  assert.fieldEquals('Market', '1', 'address', market);
  assert.fieldEquals('Market', '1', 'created_at', timestamp.toString());
  assert.fieldEquals('Market', '1', 'created_at_block', blockNumber.toString());
  assert.fieldEquals('Market', '1', 'updated_at', timestamp.toString());
  assert.fieldEquals('Market', '1', 'updated_at_block', blockNumber.toString());
  assert.fieldEquals('Market', '1', 'usd_deposited', '0');
  assert.fieldEquals('Market', '1', 'usd_withdrawn', '0');
  assert.fieldEquals('Market', '1', 'net_issuance', '0');
  assert.fieldEquals('Market', '1', 'reported_debt', '0');
}
