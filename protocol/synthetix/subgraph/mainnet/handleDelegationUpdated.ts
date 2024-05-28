import { BigInt, log } from '@graphprotocol/graph-ts';
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
    vault.collateral_amount = event.params.amount.toBigDecimal();
    vault.collateral_type = event.params.collateralType.toHex();
    vault.pool = event.params.poolId.toString();
  } else {
    if (position) {
      const isIncreasing = event.params.amount.toBigDecimal().gt(position.collateral_amount);
      if (isIncreasing) {
        // if the user is increasing his existing collateral we need to remove the previous collateral
        vault.collateral_amount = vault.collateral_amount.plus(
          event.params.amount.toBigDecimal().minus(position.collateral_amount)
        );
      } else {
        // if the user is decreasong his existing collateral event.params.amount gonna be negative
        vault.collateral_amount = vault.collateral_amount.plus(event.params.amount.toBigDecimal());
      }
    } else {
      // if no position is yet created, we just add it to the vault
      vault.collateral_amount = vault.collateral_amount.plus(event.params.amount.toBigDecimal());
    }
  }

  if (position === null) {
    position = new Position(id);
    position.created_at = event.block.timestamp;
    position.created_at_block = event.block.number;
    position.account = event.params.accountId.toString();
  }

  position.pool = event.params.poolId.toString();
  position.collateral_type = event.params.collateralType.toHex();
  position.collateral_amount = event.params.amount.gt(BigInt.fromI32(0))
    ? event.params.amount.toBigDecimal()
    : position.collateral_amount.plus(event.params.amount.toBigDecimal());
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
