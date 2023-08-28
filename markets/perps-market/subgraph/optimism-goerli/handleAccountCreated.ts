import { AccountCreated } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { Account } from './generated/schema';

export function handleAccountCreated(event: AccountCreated): void {
  const id = event.params.accountId.toString();

  const account = new Account(id);

  account.accountId = event.params.accountId;
  account.owner = event.params.owner.toHexString();
  account.save();
}
