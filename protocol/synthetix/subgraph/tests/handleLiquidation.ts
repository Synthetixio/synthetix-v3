import { assert } from 'matchstick-as';
import { Address, BigInt } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import { handleLiquidation } from '../mainnet';
import { createLiquidationEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newLiquidationEvent = createLiquidationEvent(
    BigInt.fromI32(1),
    BigInt.fromI32(2),
    Address.fromString(address),
    BigInt.fromI32(300),
    BigInt.fromI32(200),
    BigInt.fromI32(100),
    BigInt.fromI32(10),
    Address.fromString(address2),
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
