import { assert } from 'matchstick-as';
import { Address, BigInt, Bytes, store } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import { handleCollateralConfigured } from '../mainnet';
import { createCollateralConfiguredEvent } from './event-factories';
import { mockERC20Name, mockERC20Symbol, mockERC20Decimals } from './utils';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();

  mockERC20Name(Address.fromString(address), 'Synthetic USDC');
  mockERC20Symbol(Address.fromString(address), 'sUSDC');
  mockERC20Decimals(Address.fromString(address), 18);

  const newCollateralConfiguredEvent = createCollateralConfiguredEvent(
    Address.fromString(address),
    true,
    BigInt.fromI32(200),
    BigInt.fromI32(50),
    BigInt.fromI32(90),
    Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(10))),
    BigInt.fromI32(500),
    now,
    now - 1000
  );
  handleCollateralConfigured(newCollateralConfiguredEvent);
  const newCollateralConfiguredEvent2 = createCollateralConfiguredEvent(
    Address.fromString(address),
    true,
    BigInt.fromI32(300),
    BigInt.fromI32(60),
    BigInt.fromI32(80),
    Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(10))),
    BigInt.fromI32(400),
    now + 1000,
    now
  );

  handleCollateralConfigured(newCollateralConfiguredEvent2);

  assert.fieldEquals('CollateralType', address, 'id', address);
  assert.fieldEquals('CollateralType', address, 'created_at', now.toString());
  assert.fieldEquals('CollateralType', address, 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('CollateralType', address, 'updated_at', (now + 1000).toString());
  assert.fieldEquals('CollateralType', address, 'updated_at_block', now.toString());
  assert.fieldEquals('CollateralType', address, 'liquidation_reward', '80');
  assert.fieldEquals('CollateralType', address, 'liquidation_ratio', '60');
  assert.fieldEquals('CollateralType', address, 'depositing_enabled', 'true');
  assert.fieldEquals('CollateralType', address, 'issuance_ratio', '300');
  assert.fieldEquals('CollateralType', address, 'min_delegation', '400');
  assert.fieldEquals('CollateralType', address, 'oracle_node_id', '10');
  assert.fieldEquals('CollateralType', address, 'name', 'Synthetic USDC');
  assert.fieldEquals('CollateralType', address, 'symbol', 'sUSDC');
  assert.fieldEquals('CollateralType', address, 'decimals', '18');
  assert.assertNull(store.get('CollateralType', address)!.get('total_amount_deposited'));
  assert.notInStore('CollateralType', address2);
}
