import { assert } from 'matchstick-as';
import { address, address2 } from './constants';
import { handleLiquidation } from '../mainnet';
import { createLiquidationEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();

  const accountId = 1;
  const poolId = 2;
  const debtLiquidated = 300;
  const collateralLiquidated = 200;
  const amountRewarded = 100;
  const liquidatedAsAccountId = 10;
  const newLiquidationEvent = createLiquidationEvent(
    accountId,
    poolId,
    address,
    debtLiquidated,
    collateralLiquidated,
    amountRewarded,
    liquidatedAsAccountId,
    address2,
    now,
    now - 1000
  );
  handleLiquidation(newLiquidationEvent);
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'id', `1-2-${address}-1`);
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'created_at', now.toString());
  assert.fieldEquals(
    'Liquidation',
    `1-2-${address}-1`,
    'created_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'updated_at', now.toString());
  assert.fieldEquals(
    'Liquidation',
    `1-2-${address}-1`,
    'updated_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'account', '1');
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'pool', '2');
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'collateral_type', address);
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'debt_liquidated', '300');
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'collateral_liquidated', '200');
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'amount_rewarded', '100');
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'liquidate_as_account_id', '10');
  assert.fieldEquals('Liquidation', `1-2-${address}-1`, 'sender', address2);
}
