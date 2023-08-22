import { assert, createMockedFunction } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { address, defaultGraphContractAddress } from './constants';
import { handleDelegationUpdated, handleUSDBurned, handleUSDMinted } from '../mainnet';
import {
  createDelegationUpdateEvent,
  createUSDBurnedEvent,
  createUSDMintedEvent,
} from './event-factories';

export default function test(): void {
  // Needs to be here because of Closures
  const now = new Date(1668448739566).getTime();
  const newDelegationUpdatedEvent = createDelegationUpdateEvent(
    BigInt.fromI32(1),
    BigInt.fromI32(1),
    Address.fromString(address),
    BigInt.fromI32(2323),
    BigInt.fromI32(10),
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
  const newUSDMintedEvent = createUSDMintedEvent(
    BigInt.fromI32(1),
    BigInt.fromI32(1),
    Address.fromString(address),
    BigInt.fromI32(2000),
    now + 1000,
    now
  );
  handleUSDMinted(newUSDMintedEvent);
  const newUSDBurnedEvent = createUSDBurnedEvent(
    BigInt.fromI32(1),
    BigInt.fromI32(1),
    Address.fromString(address),
    BigInt.fromI32(2000),
    now + 1000,
    now
  );
  handleUSDBurned(newUSDBurnedEvent);
  assert.fieldEquals('Position', `1-1-${address}`, 'id', `1-1-${address}`);
  assert.fieldEquals('Position', `1-1-${address}`, 'created_at', now.toString());
  assert.fieldEquals('Position', `1-1-${address}`, 'created_at_block', (now - 1000).toString());
  assert.fieldEquals('Position', `1-1-${address}`, 'collateral_amount', '2323');
  assert.fieldEquals('Position', `1-1-${address}`, 'updated_at', (now + 1000).toString());
  assert.fieldEquals('Position', `1-1-${address}`, 'updated_at_block', now.toString());
  // assert.fieldEquals('Position', `1-1-${address}`, 'c_ratio', '200');
  assert.fieldEquals('Position', `1-1-${address}`, 'leverage', '10');
  assert.fieldEquals('Position', `1-1-${address}`, 'total_burned', '2000');
  handleUSDBurned(newUSDBurnedEvent);
  assert.fieldEquals('Position', `1-1-${address}`, 'total_burned', '4000');
}
