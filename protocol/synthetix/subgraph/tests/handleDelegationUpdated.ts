import { assert, createMockedFunction } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { address, defaultGraphContractAddress } from './constants';
import { handleDelegationUpdated } from '../mainnet';
import { createDelegationUpdateEvent } from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const accountId = 1;
  const poolId = 1;
  const amount = 2323;
  const newDelegationUpdatedEvent = createDelegationUpdateEvent(
    accountId,
    poolId,
    address,
    amount,
    10,
    now,
    now - 1000
  );
  createMockedFunction(
    Address.fromString(defaultGraphContractAddress),
    'getPositionCollateralizationRatio',
    'getPositionCollateralizationRatio(uint128,uint128,address):(uint256)'
  )
    .withArgs([
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)),
      ethereum.Value.fromAddress(Address.fromString(address)),
    ])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200))]);
  handleDelegationUpdated(newDelegationUpdatedEvent);
  assert.fieldEquals('Position', `1-1-${address}`, 'id', `1-1-${address}`);
  assert.fieldEquals('Position', `1-1-${address}`, 'created_at', now.toString());
  assert.fieldEquals('Position', `1-1-${address}`, 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('Position', `1-1-${address}`, 'collateral_amount', '2323');
  assert.fieldEquals('Position', `1-1-${address}`, 'updated_at', now.toString());
  assert.fieldEquals('Position', `1-1-${address}`, 'updated_at_block', (now - 1000).toString());
  // assert.fieldEquals('Position', `1-1-${address}`, 'c_ratio', '200');
  assert.fieldEquals('Position', `1-1-${address}`, 'leverage', '10');
  assert.fieldEquals('Position', `1-1-${address}`, 'pool', '1');
  assert.fieldEquals('Position', `1-1-${address}`, 'collateral_type', address);
  assert.fieldEquals('Vault', `1-${address}`, 'id', `1-${address}`);
  assert.fieldEquals('Vault', `1-${address}`, 'created_at', now.toString());
  assert.fieldEquals('Vault', `1-${address}`, 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('Vault', `1-${address}`, 'updated_at', now.toString());
  assert.fieldEquals('Vault', `1-${address}`, 'updated_at_block', (now - 1000).toString());
  assert.fieldEquals('Vault', `1-${address}`, 'collateral_amount', '2323');
  assert.fieldEquals('Vault', `1-${address}`, 'collateral_type', address);
  assert.fieldEquals('Vault', `1-${address}`, 'pool', '1');
  const newAmount = 10000;
  const newDelegatioNUpdatedEvent2 = createDelegationUpdateEvent(
    accountId,
    poolId,
    address,
    newAmount,
    10,
    now + 1000,
    now
  );
  handleDelegationUpdated(newDelegatioNUpdatedEvent2);
  assert.fieldEquals('Position', `1-1-${address}`, 'updated_at', (now + 1000).toString());
  assert.fieldEquals('Position', `1-1-${address}`, 'updated_at_block', now.toString());
  assert.fieldEquals('Position', `1-1-${address}`, 'collateral_amount', '10000');
  assert.fieldEquals('Vault', `1-${address}`, 'updated_at', (now + 1000).toString());
  assert.fieldEquals('Vault', `1-${address}`, 'updated_at_block', now.toString());
  assert.fieldEquals('Vault', `1-${address}`, 'collateral_amount', '10000');

  const newAccountId = 2;
  const amountFromNewAccount = 5000;
  const newDelegationUpdatedEvent3 = createDelegationUpdateEvent(
    newAccountId,
    poolId,
    address,
    amountFromNewAccount,
    10,
    now + 1000,
    now
  );
  handleDelegationUpdated(newDelegationUpdatedEvent3);

  assert.fieldEquals('Vault', `1-${address}`, 'collateral_amount', '15000');
}
