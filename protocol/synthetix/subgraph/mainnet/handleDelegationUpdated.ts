import { BigDecimal } from '@graphprotocol/graph-ts';
import { DelegationUpdated } from './generated/CoreProxy/CoreProxy';
import { Position, Vault } from './generated/schema';
import { createVaultSnapshotByDay } from './vaultSnapshotByDay';
import { createVaultSnapshotByMonth } from './vaultSnapshotByMonth';
import { createVaultSnapshotByWeek } from './vaultSnapshotByWeek';
import { createVaultSnapshotByYear } from './vaultSnapshotByYear';

export function handleDelegationUpdated(event: DelegationUpdated): void {
  const id = event.params.accountId
    .toString()
    .concat('-')
    .concat(event.params.poolId.toString())
    .concat('-')
    .concat(event.params.collateralType.toHex());
  let position = Position.load(id);

  let vault = Vault.load(
    event.params.poolId.toString().concat('-').concat(event.params.collateralType.toHex())
  );
  if (vault === null) {
    vault = new Vault(
      event.params.poolId.toString().concat('-').concat(event.params.collateralType.toHex())
    );
    vault.created_at = event.block.timestamp;
    vault.created_at_block = event.block.number;
    vault.collateral_amount = BigDecimal.fromString('0');
    vault.collateral_type = event.params.collateralType.toHex();
    vault.pool = event.params.poolId.toString();
  }

  let previous_position_amount = BigDecimal.fromString('0');
  if (position) {
    previous_position_amount = position.collateral_amount;
    let amount_delta = event.params.amount.toBigDecimal().minus(previous_position_amount);
    vault.collateral_amount = vault.collateral_amount.plus(amount_delta);
  } else {
    vault.collateral_amount = vault.collateral_amount.plus(event.params.amount.toBigDecimal());
  }

  if (position === null) {
    position = new Position(id);
    position.created_at = event.block.timestamp;
    position.created_at_block = event.block.number;
    position.account = event.params.accountId.toString();
  }

  position.pool = event.params.poolId.toString();
  position.collateral_type = event.params.collateralType.toHex();
  position.collateral_amount = event.params.amount.toBigDecimal();
  position.updated_at = event.block.timestamp;
  position.updated_at_block = event.block.number;

  // position.c_ratio = VaultModule.bind(event.address)
  //   .getPositionCollateralizationRatio(
  //     event.params.accountId,
  //     event.params.poolId,
  //     event.params.collateralType
  //   )
  //   .toBigDecimal();
  position.leverage = event.params.leverage.toBigDecimal();

  vault.updated_at = event.block.timestamp;
  vault.updated_at_block = event.block.number;
  vault.save();
  position.save();

  createVaultSnapshotByDay(vault, event);
  createVaultSnapshotByWeek(vault, event);
  createVaultSnapshotByMonth(vault, event);
  createVaultSnapshotByYear(vault, event);
}
