import { AccountLiquidated as AccountLiquidatedEvent } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { AccountLiquidated } from './generated/schema';

export function handleAccountLiquidated(event: AccountLiquidatedEvent): void {
  const id = event.params.accountId.toString() + '-' + event.block.number.toString();

  const accountLiquidated = new AccountLiquidated(id);

  accountLiquidated.accountId = event.params.accountId;
  accountLiquidated.timestamp = event.block.timestamp;
  accountLiquidated.fullyLiquidated = event.params.fullLiquidation;
  accountLiquidated.liquidationReward = event.params.reward;
  accountLiquidated.save();
}
