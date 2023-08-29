import { assert } from 'matchstick-as';
import { Address, BigInt } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import { handleVaultLiquidation } from '../mainnet';
import { createVaultLiquidationEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newVaultLiquidationEvent = createVaultLiquidationEvent(
    BigInt.fromI32(1),
    Address.fromString(address),
    BigInt.fromI32(300),
    BigInt.fromI32(200),
    BigInt.fromI32(100),
    BigInt.fromI32(10),
    Address.fromString(address2),
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
