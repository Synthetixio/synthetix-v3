import { assert, log } from 'matchstick-as';
import { handleAccountCreated } from '../optimism-goerli';
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

  // TODO: This is most likely not how it supposed to work!
  log.info('Should update a record for another account', []);
  const owner2 = '0x6900000000000000000000000000000000000000';
  handleAccountCreated(createAccountCreatedEvent(1, owner2, 20_000, 20));
  assert.entityCount('Account', 1);
  assert.fieldEquals('Account', '1', 'id', '1');
  assert.fieldEquals('Account', '1', 'accountId', '1');
  assert.fieldEquals('Account', '1', 'owner', owner2);
}
