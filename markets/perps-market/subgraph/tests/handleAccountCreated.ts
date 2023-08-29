import { assert } from 'matchstick-as';
import { handleAccountCreated } from '../optimism-goerli';
import { createAccountCreatedEvent } from './event-factories/createAccountCreatedEvent';

export default function test(): void {
  const accountCreatedEvent = createAccountCreatedEvent(
    1,
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    10_000,
    10
  );

  handleAccountCreated(accountCreatedEvent);

  assert.fieldEquals('Account', '1', 'id', '1');
  assert.fieldEquals('Account', '1', 'accountId', '1');
  assert.fieldEquals('Account', '1', 'owner', '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
  assert.notInStore('Account', '2');
}
