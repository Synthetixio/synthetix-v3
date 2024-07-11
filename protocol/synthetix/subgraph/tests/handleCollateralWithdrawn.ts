import { assert } from 'matchstick-as';
import { address, address2 } from './constants';
import {
  handleCollateralConfigured,
  handleCollateralDeposited,
  handleCollateralWithdrawn,
} from '../mainnet';
import {
  createCollateralConfiguredEvent,
  createDepositEvent,
  createWithdrawnEvent,
} from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const issuanceRatio = 200;
  const liquidationRatio = 50;
  const liquidationRewards = 90;
  const oracleNodeId = 13;
  const minDelegation = 500;
  const newCollateralConfiguredEvent = createCollateralConfiguredEvent(
    address,
    true,
    issuanceRatio,
    liquidationRatio,
    liquidationRewards,
    oracleNodeId,
    minDelegation,
    now,
    now - 1000
  );
  const accountId = 23;
  const newCollateralDepositEvent = createDepositEvent(accountId, address, 555, now + 1000, now);
  const newCollateralWithdrawnEvent = createWithdrawnEvent(
    accountId,
    address,
    100,
    now + 2000,
    now + 1000
  );
  handleCollateralConfigured(newCollateralConfiguredEvent);
  handleCollateralDeposited(newCollateralDepositEvent);
  handleCollateralWithdrawn(newCollateralWithdrawnEvent);
  assert.fieldEquals('CollateralType', address, 'id', address);
  assert.fieldEquals('CollateralType', address, 'created_at', now.toString());
  assert.fieldEquals('CollateralType', address, 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('CollateralType', address, 'updated_at', (now + 2000).toString());
  assert.fieldEquals('CollateralType', address, 'updated_at_block', (now + 1000).toString());
  assert.fieldEquals('CollateralType', address, 'total_amount_deposited', '455');
  assert.fieldEquals('CollateralType', address, 'oracle_node_id', '13');
  assert.notInStore('CollateralType', address2);
}
