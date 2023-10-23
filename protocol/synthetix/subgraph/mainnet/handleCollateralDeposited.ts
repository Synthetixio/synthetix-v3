import { Deposited } from './generated/CoreProxy/CoreProxy';
import { CollateralType } from './generated/schema';

export function handleCollateralDeposited(event: Deposited): void {
  let collateralType = CollateralType.load(event.params.collateralType.toHex());
  if (collateralType) {
    collateralType.updated_at = event.block.timestamp;
    collateralType.updated_at_block = event.block.number;
    if (collateralType.total_amount_deposited !== null) {
      // @dev we could also account for every account how much they deposited and withdrawn
      collateralType.total_amount_deposited = collateralType.total_amount_deposited!.plus(
        event.params.tokenAmount.toBigDecimal()
      );
    } else {
      collateralType.total_amount_deposited = event.params.tokenAmount.toBigDecimal();
    }
    collateralType.save();
  }
}
