import { Liquidation } from './generated/CoreProxy/CoreProxy';
import { Liquidation as LiquidationEntity } from './generated/schema';

export function handleLiquidation(event: Liquidation): void {
  const newLiquidation = new LiquidationEntity(
    event.params.accountId
      .toString()
      .concat('-')
      .concat(event.params.poolId.toString())
      .concat('-')
      .concat(event.params.collateralType.toHex())
      .concat('-')
      .concat(event.logIndex.toString())
  );

  newLiquidation.created_at = event.block.timestamp;
  newLiquidation.created_at_block = event.block.number;
  newLiquidation.updated_at = event.block.timestamp;
  newLiquidation.updated_at_block = event.block.number;
  newLiquidation.account = event.params.accountId.toString();
  newLiquidation.pool = event.params.poolId.toString();
  newLiquidation.collateral_type = event.params.collateralType;
  newLiquidation.debt_liquidated = event.params.liquidationData.debtLiquidated.toBigDecimal();
  newLiquidation.collateral_liquidated =
    event.params.liquidationData.collateralLiquidated.toBigDecimal();
  newLiquidation.amount_rewarded = event.params.liquidationData.amountRewarded.toBigDecimal();
  newLiquidation.sender = event.params.sender;
  newLiquidation.liquidate_as_account_id = event.params.liquidateAsAccountId.toString();
  newLiquidation.save();
}
