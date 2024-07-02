import { Vault, VaultSnapshotByMonth } from './generated/schema';
import { BigInt } from '@graphprotocol/graph-ts';
import { DelegationUpdated } from './generated/CoreProxy/CoreProxy';

export function createVaultSnapshotByMonth(
  vaultWithLatestValues: Vault,
  event: DelegationUpdated
): void {
  const date = new Date(<i64>parseInt(vaultWithLatestValues.updated_at.toString()) * 1000);

  const month = date.getUTCMonth().toString();
  const year = date.getUTCFullYear().toString();
  const vaultSnapshotId = vaultWithLatestValues.id
    .toString()
    .concat('-')
    .concat(year)
    .concat('-')
    .concat(month);

  let vaultSnapshotByDay = VaultSnapshotByMonth.load(vaultSnapshotId);

  if (!vaultSnapshotByDay) {
    vaultSnapshotByDay = new VaultSnapshotByMonth(vaultSnapshotId);
    vaultSnapshotByDay.updates_in_period = BigInt.fromI32(0);
    vaultSnapshotByDay.created_at = event.block.timestamp;
    vaultSnapshotByDay.created_at_block = event.block.number;
    vaultSnapshotByDay.collateral_type = vaultWithLatestValues.collateral_type;
    vaultSnapshotByDay.pool = vaultWithLatestValues.pool;
  }
  vaultSnapshotByDay.updated_at = event.block.timestamp;
  vaultSnapshotByDay.updated_at_block = event.block.number;
  vaultSnapshotByDay.updates_in_period = vaultSnapshotByDay.updates_in_period.plus(
    BigInt.fromI32(1)
  );
  vaultSnapshotByDay.collateral_amount = vaultWithLatestValues.collateral_amount;

  vaultSnapshotByDay.save();
}
