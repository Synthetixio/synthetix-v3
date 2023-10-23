import { AccountCreated } from './generated/CoreProxy/CoreProxy';
import { Account } from './generated/schema';

export function handleAccountCreated(event: AccountCreated): void {
  const account = new Account(event.params.accountId.toString());
  account.owner = event.params.owner;
  account.created_at = event.block.timestamp;
  account.created_at_block = event.block.number;
  account.updated_at = event.block.timestamp;
  account.updated_at_block = event.block.number;
  account.permissions = [];
  account.save();
}
