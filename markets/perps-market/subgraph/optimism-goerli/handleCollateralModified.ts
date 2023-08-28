import { CollateralModified as CollateralModifiedEvent } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { CollateralModified } from './generated/schema';

export function handleCollateralModified(event: CollateralModifiedEvent): void {
  const id =
    event.params.accountId.toString() +
    '-' +
    event.block.number.toString() +
    '-' +
    event.logIndex.toString();

  const collateralModified = new CollateralModified(id);

  collateralModified.accountId = event.params.accountId;
  collateralModified.timestamp = event.block.timestamp;
  collateralModified.synthMarketId = event.params.synthMarketId;
  collateralModified.amount = event.params.amountDelta;
  collateralModified.sender = event.params.sender;

  collateralModified.save();
}
