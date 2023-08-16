import {
  AccountCreated,
  AccountLiquidated,
  PositionLiquidated,
} from '../generated/PerpsMarketProxy/PerpsMarketProxy';

import { Account, LiquidatedAccount, LiquidatedPosition } from '../generated/schema';

export function handleAccountCreated(event: AccountCreated): void {
  const id = event.params.accountId.toString();

  const account = new Account(id);

  account.accountId = event.params.accountId;
  account.owner = event.params.owner.toHexString();
  account.save();
}

export function handleAccountLiquidated(event: AccountLiquidated): void {
  const id = event.transaction.hash.toHexString();

  const account = new LiquidatedAccount(id);

  account.accountId = event.params.accountId;
  account.accountFullyLiquidated = event.params.fullLiquidation;
  account.keeperLiquidationReward = event.params.reward;
  account.save();
}

export function handlePositionLiquidated(event: PositionLiquidated): void {
  const id = event.transaction.hash.toHexString();

  const account = new LiquidatedPosition(id);

  account.accountId = event.params.accountId;
  account.marketId = event.params.marketId;
  account.amountLiquidated = event.params.amountLiquidated;
  account.currentPositionSize = event.params.currentPositionSize;

  account.save();
}
