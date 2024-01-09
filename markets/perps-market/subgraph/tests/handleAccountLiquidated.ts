import { assert, log } from 'matchstick-as';
import { handleAccountLiquidated } from '../optimism-goerli';
import { createAccountLiquidatedEvent } from './event-factories/createAccountLiquidatedEvent';

export default function test(): void {
  assert.entityCount('AccountLiquidated', 0);

  log.info('Should create a new record for the liquidation', []);
  handleAccountLiquidated(createAccountLiquidatedEvent(1, 123, true, 10_000, 10));
  assert.entityCount('AccountLiquidated', 1);
  assert.fieldEquals('AccountLiquidated', '1-10', 'accountId', '1');
  assert.fieldEquals('AccountLiquidated', '1-10', 'timestamp', '10000');
  assert.fieldEquals('AccountLiquidated', '1-10', 'liquidationReward', '123');
  assert.fieldEquals('AccountLiquidated', '1-10', 'fullyLiquidated', 'true');

  // TODO: can we have 2 separate liquidation events in the same block? Potentially yes
  log.info('Should create another record for the liquidation of the same account', []);
  handleAccountLiquidated(createAccountLiquidatedEvent(1, 123, true, 20_000, 20));
  assert.entityCount('AccountLiquidated', 2);
  assert.fieldEquals('AccountLiquidated', '1-20', 'accountId', '1');
  assert.fieldEquals('AccountLiquidated', '1-20', 'timestamp', '20000');
  assert.fieldEquals('AccountLiquidated', '1-20', 'liquidationReward', '123');
  assert.fieldEquals('AccountLiquidated', '1-20', 'fullyLiquidated', 'true');
}
