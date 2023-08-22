import { assert } from 'matchstick-as';
import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
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
  const newCollateralConfiguredEvent = createCollateralConfiguredEvent(
    Address.fromString(address),
    true,
    BigInt.fromI32(200),
    BigInt.fromI32(50),
    BigInt.fromI32(90),
    Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(13))),
    BigInt.fromI32(500),
    now,
    now - 1000
  );
  const newCollateralDepositEvent = createDepositEvent(
    23,
    Address.fromString(address),
    BigInt.fromI32(555),
    now + 1000,
    now
  );
  const newCollateralWithdrawnEvent = createWithdrawnEvent(
    23,
    Address.fromString(address),
    BigInt.fromI32(100),
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
