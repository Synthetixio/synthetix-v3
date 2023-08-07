import {
  AccountCreated,
  AccountLiquidated as AccountLiquidatedEvent,
  PositionLiquidated as PositionLiquidatedEvent,
  CollateralModified as CollateralModifiedEvent,
} from '../generated/PerpsMarketProxy/PerpsMarketProxy';

import {
  Account,
  AccountLiquidated,
  PositionLiquidated,
  CollateralModified,
} from '../generated/schema';

export function handleAccountCreated(event: AccountCreated): void {
  const id = event.params.accountId.toString();

  const account = new Account(id);

  account.accountId = event.params.accountId;
  account.owner = event.params.owner.toHexString();
  account.save();
}

export function handleAccountLiquidated(event: AccountLiquidatedEvent): void {
  const id = event.params.accountId.toString() + '-' + event.block.number.toString();

  const accountLiquidated = new AccountLiquidated(id);

  accountLiquidated.accountId = event.params.accountId;
  accountLiquidated.timestamp = event.block.timestamp;
  accountLiquidated.fullyLiquidated = event.params.fullLiquidation;
  accountLiquidated.liquidationReward = event.params.reward;
  accountLiquidated.save();
}

export function handlePositionLiquidated(event: PositionLiquidatedEvent): void {
  const id =
    event.params.marketId.toString() +
    '-' +
    event.params.accountId.toString() +
    '-' +
    event.block.number.toString();

  const positionLiquidated = new PositionLiquidated(id);

  positionLiquidated.accountId = event.params.accountId;
  positionLiquidated.timestamp = event.block.timestamp;
  positionLiquidated.marketId = event.params.marketId;
  positionLiquidated.amountLiquidated = event.params.amountLiquidated;
  positionLiquidated.currentPositionSize = event.params.currentPositionSize;

  positionLiquidated.save();
}

export function handleCollateralModified(event: CollateralModifiedEvent): void {
  const id =
    event.params.accountId.toString() +
    '-' +
    event.block.number.toString() +
    event.logIndex.toString();

  const collateralModified = new CollateralModified(id);

  collateralModified.accountId = event.params.accountId;
  collateralModified.timestamp = event.block.timestamp;
  collateralModified.synthMarketId = event.params.synthMarketId;
  collateralModified.amount = event.params.amountDelta;
  collateralModified.sender = event.params.sender;

  collateralModified.save();
}
