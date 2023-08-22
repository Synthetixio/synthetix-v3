import { UsdMinted } from './generated/CoreProxy/CoreProxy';
import { Position } from './generated/schema';

export function handleUSDMinted(event: UsdMinted): void {
  const position = Position.load(
    event.params.accountId
      .toString()
      .concat('-')
      .concat(
        event.params.poolId.toString().concat('-').concat(event.params.collateralType.toHex())
      )
  );
  if (position !== null) {
    position.updated_at = event.block.timestamp;
    position.updated_at_block = event.block.number;
    if (position.total_minted !== null) {
      position.total_minted = position.total_minted!.plus(event.params.amount.toBigDecimal());
    } else {
      position.total_minted = event.params.amount.toBigDecimal();
    }
    if (position.net_issuance !== null) {
      position.net_issuance = position.net_issuance!.plus(event.params.amount.toBigDecimal());
    } else {
      position.net_issuance = event.params.amount.toBigDecimal();
    }
    position.save();
  }
}
