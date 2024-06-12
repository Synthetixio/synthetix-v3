import { assert } from 'matchstick-as';
import { store } from '@graphprotocol/graph-ts';
import { address, address2 } from './constants';
import { handleCollateralConfigured } from '../mainnet';
import { createCollateralConfiguredEvent } from './event-factories/createCollateralConfiguredEvent';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newCollateralConfiguredEvent = createCollateralConfiguredEvent(
    address,
    true,
    200,
    50,
    90,
    10,
    500,
    now,
    now - 1000
  );
  handleCollateralConfigured(newCollateralConfiguredEvent);
  const newCollateralConfiguredEvent2 = createCollateralConfiguredEvent(
    address,
    true,
    300,
    60,
    80,
    10,
    400,
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
  assert.assertNull(store.get('CollateralType', address)!.get('total_amount_deposited'));
  assert.notInStore('CollateralType', address2);
}
