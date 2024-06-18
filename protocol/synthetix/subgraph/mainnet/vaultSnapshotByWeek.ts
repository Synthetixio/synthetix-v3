import { Vault, VaultSnapshotByWeek } from './generated/schema';
import { getISOWeekNumber } from './getISOWeekNumber';
import { BigInt } from '@graphprotocol/graph-ts';
import { DelegationUpdated } from './generated/CoreProxy/CoreProxy';

export function createVaultSnapshotByWeek(
  vaultWithLatestValues: Vault,
  event: DelegationUpdated
): void {
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
    vaultSnapshotByWeek = new VaultSnapshotByWeek(vaultSnapshotId);
    vaultSnapshotByWeek.updates_in_period = BigInt.fromI32(0);
    vaultSnapshotByWeek.created_at = event.block.timestamp;
    vaultSnapshotByWeek.created_at_block = event.block.number;
    vaultSnapshotByWeek.collateral_type = vaultWithLatestValues.collateral_type;
    vaultSnapshotByWeek.pool = vaultWithLatestValues.pool;
  }
  vaultSnapshotByWeek.updated_at = event.block.timestamp;
  vaultSnapshotByWeek.updated_at_block = event.block.number;
  vaultSnapshotByWeek.updates_in_period = vaultSnapshotByWeek.updates_in_period.plus(
    BigInt.fromI32(1)
  );
  vaultSnapshotByWeek.collateral_amount = vaultWithLatestValues.collateral_amount;

  vaultSnapshotByWeek.save();
}
