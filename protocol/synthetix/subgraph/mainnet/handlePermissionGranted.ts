import { PermissionGranted } from './generated/CoreProxy/CoreProxy';
import { Account, AccountPermissionUsers } from './generated/schema';

export function handlePermissionGranted(event: PermissionGranted): void {
  const account = Account.load(event.params.accountId.toString());
  if (account !== null) {
    let accountPermissionUsers = AccountPermissionUsers.load(
      event.params.accountId.toString().concat('-').concat(event.params.user.toHex())
    );
    if (accountPermissionUsers === null) {
      accountPermissionUsers = new AccountPermissionUsers(
        event.params.accountId.toString().concat('-').concat(event.params.user.toHex())
      );
      accountPermissionUsers.created_at = event.block.timestamp;
      accountPermissionUsers.created_at_block = event.block.number;
      accountPermissionUsers.permissions = [event.params.permission];
    } else {
      const newState = accountPermissionUsers.permissions;
      newState.push(event.params.permission);
      accountPermissionUsers.permissions = newState;
    }
    accountPermissionUsers.updated_at = event.block.timestamp;
    accountPermissionUsers.updated_at_block = event.block.number;
    accountPermissionUsers.address = event.params.user;
    accountPermissionUsers.account = account.id;
    if (account.permissions === null) {
      account.permissions = [accountPermissionUsers.id];
    } else if (!account.permissions!.includes(accountPermissionUsers.id)) {
      const newState = account.permissions!;
      newState.push(accountPermissionUsers.id);
      account.permissions = newState;
    }
    account.updated_at = event.block.timestamp;
    account.updated_at_block = event.block.number;
    accountPermissionUsers.save();
    account.save();
  }
}
