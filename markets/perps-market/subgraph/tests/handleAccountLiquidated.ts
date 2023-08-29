import { assert } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { handleAccountLiquidated } from '../optimism-goerli';
import { createAccountLiquidatedEvent } from './event-factories/createAccountLiquidatedEvent';

export default function test(): void {
  const accountLiquidatedEvent = createAccountLiquidatedEvent(1, 123, true, 10_000, 10);

  handleAccountLiquidated(accountLiquidatedEvent);

  assert.fieldEquals('AccountLiquidated', '1-10', 'accountId', '1');
  assert.fieldEquals('AccountLiquidated', '1-10', 'timestamp', '10000');
  assert.fieldEquals('AccountLiquidated', '1-10', 'liquidationReward', '123');
  assert.fieldEquals('AccountLiquidated', '1-10', 'fullyLiquidated', 'true');
}
