import { assert } from 'matchstick-as';
import { address, address2 } from './constants';
import { handleVaultLiquidation } from '../mainnet';
import { createVaultLiquidationEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();

  const poolId = 1;
  const debtLiquidated = 300;
  const collateralLiquidated = 200;
  const amountRewarded = 100;
  const liquidatedAsAccountId = 10;
  const newVaultLiquidationEvent = createVaultLiquidationEvent(
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
  handleVaultLiquidation(newVaultLiquidationEvent);
  assert.fieldEquals('VaultLiquidation', `1-${address}-1`, 'id', `1-${address}-1`);
  assert.fieldEquals('VaultLiquidation', `1-${address}-1`, 'created_at', now.toString());
  assert.fieldEquals(
    'VaultLiquidation',
    `1-${address}-1`,
    'created_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals('VaultLiquidation', `1-${address}-1`, 'updated_at', now.toString());
  assert.fieldEquals(
    'VaultLiquidation',
    `1-${address}-1`,
    'updated_at_block',
    (now - 1000).toString()
  );
  assert.fieldEquals('VaultLiquidation', `1-${address}-1`, 'pool', '1');
  assert.fieldEquals('VaultLiquidation', `1-${address}-1`, 'collateral_type', address);
  assert.fieldEquals('VaultLiquidation', `1-${address}-1`, 'sender', address2);
  assert.fieldEquals('VaultLiquidation', `1-${address}-1`, 'liquidate_as_account_id', '10');
}
