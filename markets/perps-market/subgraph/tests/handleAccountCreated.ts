import { assert, log } from 'matchstick-as';
import { handleAccountCreated } from '../base-mainnet-andromeda';
import { createAccountCreatedEvent } from './event-factories/createAccountCreatedEvent';

export default function test(): void {
  assert.entityCount('Account', 0);

  log.info('Should create a new record for the account', []);
  const owner1 = '0x4200000000000000000000000000000000000000';
  handleAccountCreated(createAccountCreatedEvent(1, owner1, 10_000, 10));
  assert.entityCount('Account', 1);
  assert.fieldEquals('Account', '1', 'id', '1');
  assert.fieldEquals('Account', '1', 'accountId', '1');
  assert.fieldEquals('Account', '1', 'owner', owner1);
}
