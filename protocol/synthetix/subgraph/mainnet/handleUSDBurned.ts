import { UsdBurned } from './generated/CoreProxy/CoreProxy';
import { Position } from './generated/schema';

export function handleUSDBurned(event: UsdBurned): void {
  const position = Position.load(
    event.params.accountId
      .toString()
      .concat(
        '-'.concat(
          event.params.poolId.toString().concat('-').concat(event.params.collateralType.toHex())
        )
      )
  );
  if (position !== null) {
    if (position.total_burned !== null) {
      position.total_burned = position.total_burned!.plus(event.params.amount.toBigDecimal());
    } else {
      position.total_burned = event.params.amount.toBigDecimal();
    }
    if (position.net_issuance !== null) {
      position.net_issuance = position.net_issuance!.minus(event.params.amount.toBigDecimal());
    } else {
      position.net_issuance = event.params.amount.toBigDecimal();
    }
    position.updated_at = event.block.timestamp;
    position.updated_at_block = event.block.number;
    position.save();
  }
}
