import { VaultLiquidation } from './generated/CoreProxy/CoreProxy';
import { VaultLiquidation as VaultLiquidationEntity } from './generated/schema';

export function handleVaultLiquidation(event: VaultLiquidation): void {
  const newVaultLiquidation = new VaultLiquidationEntity(
    event.params.poolId
      .toString()
      .concat('-')
      .concat(event.params.collateralType.toHex())
      .concat('-')
      .concat(event.logIndex.toString())
  );
  newVaultLiquidation.created_at = event.block.timestamp;
  newVaultLiquidation.created_at_block = event.block.number;
  newVaultLiquidation.updated_at = event.block.timestamp;
  newVaultLiquidation.updated_at_block = event.block.number;
  newVaultLiquidation.pool = event.params.poolId.toString();
  newVaultLiquidation.collateral_type = event.params.collateralType;
  newVaultLiquidation.amount_rewarded = event.params.liquidationData.amountRewarded.toBigDecimal();
  newVaultLiquidation.amount_liquidated =
    event.params.liquidationData.debtLiquidated.toBigDecimal();
  newVaultLiquidation.collateral_liquidated =
    event.params.liquidationData.collateralLiquidated.toBigDecimal();
  newVaultLiquidation.amount_rewarded = event.params.liquidationData.amountRewarded.toBigDecimal();
  newVaultLiquidation.liquidate_as_account_id = event.params.liquidateAsAccountId.toString();
  newVaultLiquidation.sender = event.params.sender;
  newVaultLiquidation.save();
}
