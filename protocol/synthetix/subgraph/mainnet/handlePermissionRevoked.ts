import { PermissionRevoked } from './generated/CoreProxy/CoreProxy';
import { Account, AccountPermissionUsers } from './generated/schema';
import { Bytes, store } from '@graphprotocol/graph-ts';

export function handlePermissionRevoked(event: PermissionRevoked): void {
  const account = Account.load(event.params.accountId.toString());
  const permissions = AccountPermissionUsers.load(
    event.params.accountId.toString().concat('-').concat(event.params.user.toHex())
  );
  if (account !== null && permissions !== null) {
    const newState: Bytes[] = [];
    for (let i = 0; i < permissions.permissions.length; ++i) {
      if (permissions.permissions.at(i) !== event.params.permission) {
        newState.push(permissions.permissions.at(i));
      }
    }
    // If newState is empty, we know that all the permissions have been revoked and we can
    // remove the entity from the store
    if (newState.length === 0) {
      store.remove(
        'AccountPermissionUsers',
        event.params.accountId.toString().concat('-').concat(event.params.user.toHex())
      );
      const newAccountIdsState: string[] = [];
      for (let i = 0; i < account.permissions!.length; ++i) {
        if (
          account.permissions!.at(i) !==
          event.params.accountId.toString().concat('-').concat(event.params.user.toHex())
        ) {
          newAccountIdsState.push(
            event.params.accountId.toString().concat('-').concat(event.params.user.toHex())
          );
        }
      }
      account.permissions = newAccountIdsState;
    } else {
      permissions.permissions = newState;
    }
    permissions.updated_at = event.block.timestamp;
    permissions.updated_at_block = event.block.number;
    account.updated_at = event.block.timestamp;
    account.updated_at_block = event.block.number;
    account.save();
    permissions.save();
  }
}
