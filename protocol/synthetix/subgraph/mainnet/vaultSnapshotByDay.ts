import { Vault, VaultSnapshotByDay } from './generated/schema';
import { BigInt } from '@graphprotocol/graph-ts';

export function createVaultSnapshotByDay(vaultWithLatestValues: Vault): void {
  const date = new Date(<i64>parseInt(vaultWithLatestValues.updated_at.toString()) * 1000);

  const vaultSnapshotId = vaultWithLatestValues.id
    .toString()
    .concat(date.toISOString().slice(0, 10));

  let vaultSnapshotByDay = VaultSnapshotByDay.load(vaultSnapshotId);

  if (!vaultSnapshotByDay) {
    vaultSnapshotByDay = new VaultSnapshotByDay(vaultSnapshotId);
    vaultSnapshotByDay.updates_in_period = new BigInt(0);
    vaultSnapshotByDay.created_at = vaultWithLatestValues.created_at;
    vaultSnapshotByDay.created_at_block = vaultWithLatestValues.created_at_block;
    vaultSnapshotByDay.collateral_amount = vaultWithLatestValues.collateral_amount;
    vaultSnapshotByDay.collateral_type = vaultWithLatestValues.collateral_type;
    vaultSnapshotByDay.pool = vaultWithLatestValues.pool;
    vaultSnapshotByDay.updated_at_block = vaultWithLatestValues.updated_at_block;
    vaultSnapshotByDay.updated_at = vaultWithLatestValues.updated_at;
  }
  vaultSnapshotByDay.updated_at = vaultWithLatestValues.updated_at;
  vaultSnapshotByDay.updated_at_block = vaultWithLatestValues.updated_at_block;
  vaultSnapshotByDay.updates_in_period = vaultSnapshotByDay.updates_in_period.plus(new BigInt(1));
  vaultSnapshotByDay.collateral_amount = vaultSnapshotByDay.collateral_amount.plus(
    vaultWithLatestValues.collateral_amount
  );
  vaultSnapshotByDay.save();
}
