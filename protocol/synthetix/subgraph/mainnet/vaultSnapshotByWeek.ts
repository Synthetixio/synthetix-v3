import { Vault, VaultSnapshotByWeek } from './generated/schema';
import { getISOWeekNumber } from './getISOWeekNumber';
import { BigInt } from '@graphprotocol/graph-ts';

export function createVaultSnapshotByWeek(vaultWithLatestValues: Vault): void {
  const date = new Date(<i64>parseInt(vaultWithLatestValues.updated_at.toString()) * 1000);

  const year = date.getUTCFullYear().toString();
  const week = getISOWeekNumber(date.getTime());

  const vaultSnapshotId = vaultWithLatestValues.id
    .toString()
    .concat('-week-')
    .concat(year)
    .concat('-')
    .concat(week.toString());

  let vaultSnapshotByWeek = VaultSnapshotByWeek.load(vaultSnapshotId);

  if (!vaultSnapshotByWeek) {
    // If we have two events in the same week update the data fields
    vaultSnapshotByWeek = new VaultSnapshotByWeek(vaultSnapshotId);
    vaultSnapshotByWeek.updates_in_period = new BigInt(0);
    vaultSnapshotByWeek.created_at = vaultWithLatestValues.created_at;
    vaultSnapshotByWeek.created_at_block = vaultWithLatestValues.created_at_block;
    vaultSnapshotByWeek.collateral_amount = vaultWithLatestValues.collateral_amount;
    vaultSnapshotByWeek.collateral_type = vaultWithLatestValues.collateral_type;
    vaultSnapshotByWeek.pool = vaultWithLatestValues.pool;
    vaultSnapshotByWeek.updated_at_block = vaultWithLatestValues.updated_at_block;
    vaultSnapshotByWeek.updated_at = vaultWithLatestValues.updated_at;
  }
  vaultSnapshotByWeek.updated_at = vaultWithLatestValues.updated_at;
  vaultSnapshotByWeek.updated_at_block = vaultWithLatestValues.updated_at_block;
  vaultSnapshotByWeek.updates_in_period = vaultSnapshotByWeek.updates_in_period.plus(new BigInt(1));
  vaultSnapshotByWeek.collateral_amount = vaultSnapshotByWeek.collateral_amount.plus(
    vaultWithLatestValues.collateral_amount
  );
  vaultSnapshotByWeek.save();
}
