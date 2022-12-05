import {
  test,
  assert,
  clearStore,
  describe,
  beforeEach,
  createMockedFunction,
} from 'matchstick-as/assembly/index';
import { Address, ethereum, BigInt, Bytes, ByteArray, store } from '@graphprotocol/graph-ts';
import { address, address2, defaultGraphContractAddress } from './constants';
import {
  handleAccountCreated,
  handleCollateralConfigured,
  handleDelegationUpdated,
  handleDeposited,
  handleMarketCreated,
  handleMarketUsdDeposited,
  handleMarketUsdWithdrawn,
  handleNewPoolOwner,
  handlePoolOwnerNominated,
  handlePermissionGranted,
  handlePermissionRevoked,
  handlePoolConfigurationSet,
  handlePoolCreated,
  handlePoolNameUpdated,
  handlePoolNominationRenounced,
  handlePoolNominationRevoked,
  handleUSDBurned,
  handleUSDMinted,
  handleWithdrawn,
  handleRewardsDistributed,
  handleRewardsClaimed,
  handleRewardsDistributorRegistered,
  handleLiquidation,
  handleVaultLiquidation,
} from '../src/core';
import {
  createAccountCreatedEvent,
  createCollateralConfiguredEvent,
  createDelegationUpdateEvent,
  createDepositEvent,
  createLiquidationEvent,
  createMarketCreatedEvent,
  createMarketUsdDepositedEvent,
  createMarketUsdWithdrawnEvent,
  createPoolOwnerNominatedEvent,
  createPermissionGrantedEvent,
  createPermissionRevokedEvent,
  createPoolConfigurationSetEvent,
  createPoolCreatedEvent,
  createPoolNameUpdatedEvent,
  createPoolNominationRevokedEvent,
  createPoolOwnershipAcceptedEvent,
  createPoolOwnershipRenouncedEvent,
  createRewardsClaimedEvent,
  createRewardsDistributedEvent,
  createRewardsDistributorRegisteredEvent,
  createUSDBurnedEvent,
  createUSDMintedEvent,
  createVaultLiquidationEvent,
  createWithdrawnEvent,
} from './event-factories';

export {
  handleAccountCreated,
  handleCollateralConfigured,
  handleDelegationUpdated,
  handleDeposited,
  handleMarketCreated,
  handleMarketUsdDeposited,
  handleMarketUsdWithdrawn,
  handleNewPoolOwner,
  handlePoolOwnerNominated,
  handlePermissionGranted,
  handlePermissionRevoked,
  handlePoolConfigurationSet,
  handlePoolCreated,
  handlePoolNameUpdated,
  handlePoolNominationRenounced,
  handlePoolNominationRevoked,
  handleUSDBurned,
  handleUSDMinted,
  handleWithdrawn,
  handleRewardsDistributed,
  handleRewardsClaimed,
  handleRewardsDistributorRegistered,
  handleLiquidation,
  handleVaultLiquidation,
};

describe('core tests', () => {
  beforeEach(() => {
    clearStore();
  });

  test('handlePoolCreated', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
    handlePoolCreated(newPoolEvent);
    assert.fieldEquals('Pool', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'owner', address);
    assert.fieldEquals('Pool', '1', 'created_at', now.toString());
    assert.fieldEquals('Pool', '1', 'created_at_block', (now - 1000).toString());
    assert.entityCount('Pool', 1);
    assert.assertNull(store.get('Pool', '1')!.get('nominated_owner'));
    assert.assertNull(store.get('Pool', '1')!.get('name'));
    assert.assertNull(store.get('Pool', '1')!.get('total_weight'));
    assert.assertNull(store.get('Pool', '1')!.get('configurations'));
    assert.notInStore('Pool', '2');
  });

  test('handleNominatedPoolOwner', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
    const newNominatedPoolOwnerEvent = createPoolOwnerNominatedEvent(
      1,
      address2,
      address,
      now + 1000,
      now
    );
    handlePoolCreated(newPoolEvent);
    handlePoolOwnerNominated(newNominatedPoolOwnerEvent);
    assert.fieldEquals('Pool', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'owner', address);
    assert.fieldEquals('Pool', '1', 'nominated_owner', address2);
    assert.fieldEquals('Pool', '1', 'created_at', now.toString());
    assert.fieldEquals('Pool', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at_block', now.toString());
    assert.assertNull(store.get('Pool', '1')!.get('name'));
    assert.assertNull(store.get('Pool', '1')!.get('total_weight'));
    assert.assertNull(store.get('Pool', '1')!.get('configurations'));
    assert.notInStore('Pool', '2');
  });

  test('handlePoolNameUpdated', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
    const newPoolNameEvent = createPoolNameUpdatedEvent(1, 'SC Pool', now + 1000, now);
    handlePoolCreated(newPoolEvent);
    handlePoolNameUpdated(newPoolNameEvent);
    assert.fieldEquals('Pool', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'name', 'SC Pool');
    assert.fieldEquals('Pool', '1', 'created_at', now.toString());
    assert.fieldEquals('Pool', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at_block', now.toString());
    assert.assertNull(store.get('Pool', '1')!.get('nominated_owner'));
    assert.assertNull(store.get('Pool', '1')!.get('total_weight'));
    assert.assertNull(store.get('Pool', '1')!.get('configurations'));
    assert.notInStore('Pool', '2');
  });

  test('handleNewPoolOwner', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newPool = createPoolCreatedEvent(1, address, now, now - 1000);
    const newOwnerEvent = createPoolOwnershipAcceptedEvent(1, address2, now + 1000, now);
    const newNominatedPoolOwnerEvent = createPoolOwnerNominatedEvent(
      1,
      address2,
      address,
      now + 1000,
      now
    );
    handlePoolCreated(newPool);
    handlePoolOwnerNominated(newNominatedPoolOwnerEvent);
    assert.fieldEquals('Pool', '1', 'nominated_owner', address2);
    handleNewPoolOwner(newOwnerEvent);
    assert.fieldEquals('Pool', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'owner', address2);
    assert.fieldEquals('Pool', '1', 'nominated_owner', '0x00000000');
    assert.fieldEquals('Pool', '1', 'created_at', now.toString());
    assert.fieldEquals('Pool', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at_block', now.toString());
    assert.assertNull(store.get('Pool', '1')!.get('name'));
    assert.assertNull(store.get('Pool', '1')!.get('total_weight'));
    assert.assertNull(store.get('Pool', '1')!.get('configurations'));
    assert.notInStore('Pool', '2');
  });

  test('handlePoolNominationRenounced', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newPool = createPoolCreatedEvent(1, address, now, now - 1000);
    const newNominatedPoolOwnerEvent = createPoolOwnerNominatedEvent(
      1,
      address2,
      address,
      now + 1000,
      now
    );
    const newPoolOwnershipRenouncedEvent = createPoolOwnershipRenouncedEvent(1, now + 1000, now);
    handlePoolCreated(newPool);
    handlePoolOwnerNominated(newNominatedPoolOwnerEvent);
    handlePoolNominationRenounced(newPoolOwnershipRenouncedEvent);
    assert.fieldEquals('Pool', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'owner', address);
    assert.fieldEquals('Pool', '1', 'nominated_owner', '0x00000000');
    assert.fieldEquals('Pool', '1', 'created_at', now.toString());
    assert.fieldEquals('Pool', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at_block', now.toString());
    assert.assertNull(store.get('Pool', '1')!.get('name'));
    assert.assertNull(store.get('Pool', '1')!.get('total_weight'));
    assert.assertNull(store.get('Pool', '1')!.get('configurations'));
    assert.notInStore('Pool', '2');
  });

  test('handlePoolNominationRevoked', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newPool = createPoolCreatedEvent(1, address, now, now - 1000);
    const newNominatedPoolOwnerEvent = createPoolOwnerNominatedEvent(
      1,
      address2,
      address,
      now + 1000,
      now
    );
    const newPoolNominationRevokedEvent = createPoolNominationRevokedEvent(1, now + 1000, now);
    handlePoolCreated(newPool);
    handlePoolOwnerNominated(newNominatedPoolOwnerEvent);
    handlePoolNominationRevoked(newPoolNominationRevokedEvent);
    assert.fieldEquals('Pool', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'owner', address);
    assert.fieldEquals('Pool', '1', 'nominated_owner', '0x00000000');
    assert.fieldEquals('Pool', '1', 'created_at', now.toString());
    assert.fieldEquals('Pool', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at_block', now.toString());
    assert.assertNull(store.get('Pool', '1')!.get('name'));
    assert.assertNull(store.get('Pool', '1')!.get('total_weight'));
    assert.assertNull(store.get('Pool', '1')!.get('configurations'));
    assert.notInStore('Pool', '2');
  });

  test('handleMarketCreated', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newMarketRegisteredEvent = createMarketCreatedEvent(1, address, now, now - 1000);
    handleMarketCreated(newMarketRegisteredEvent);
    assert.fieldEquals('Market', '1', 'id', '1');
    assert.fieldEquals('Market', '1', 'address', address);
    assert.fieldEquals('Market', '1', 'created_at', now.toString());
    assert.fieldEquals('Market', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Market', '1', 'updated_at', now.toString());
    assert.fieldEquals('Market', '1', 'updated_at_block', (now - 1000).toString());
    assert.assertNull(store.get('Market', '1')!.get('usd_deposited'));
    assert.assertNull(store.get('Market', '1')!.get('usd_withdrawn'));
    assert.assertNull(store.get('Market', '1')!.get('net_issuance'));
    assert.assertNull(store.get('Market', '1')!.get('reported_debt'));
    assert.assertNull(store.get('Market', '1')!.get('configurations'));
    assert.notInStore('Market', '2');
  });

  test('handleAccountCreated', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const accountCreatedEvent = createAccountCreatedEvent(1, address, now, now - 1000);
    handleAccountCreated(accountCreatedEvent);
    assert.fieldEquals('Account', '1', 'id', '1');
    assert.fieldEquals('Account', '1', 'owner', address);
    assert.fieldEquals('Account', '1', 'created_at', now.toString());
    assert.fieldEquals('Account', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Account', '1', 'updated_at', now.toString());
    assert.fieldEquals('Account', '1', 'updated_at_block', (now - 1000).toString());
    assert.fieldEquals('Account', '1', 'permissions', '[]');
    assert.notInStore('Account', '2');
  });

  test('handlePoolConfigurationSet', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newPoolEvent = createPoolCreatedEvent(1, address, now, now - 1000);
    const newMarketRegisteredEvent = createMarketCreatedEvent(1, address, now + 1000, now);
    const newMarketRegisteredEvent2 = createMarketCreatedEvent(2, address2, now + 2000, now + 1000);
    const markets = changetype<Array<ethereum.Tuple>>([
      changetype<Array<ethereum.Tuple>>([
        ethereum.Value.fromI32(1),
        ethereum.Value.fromI32(32),
        ethereum.Value.fromI32(812739821),
      ]),
      changetype<Array<ethereum.Tuple>>([
        ethereum.Value.fromI32(2),
        ethereum.Value.fromI32(43),
        ethereum.Value.fromI32(892379812),
      ]),
    ]);

    const newPoolConfigurationSetEvent = createPoolConfigurationSetEvent(
      1,
      markets,
      now + 3000,
      now + 2000
    );
    const secondMarkets = changetype<Array<ethereum.Tuple>>([
      changetype<Array<ethereum.Tuple>>([
        ethereum.Value.fromI32(2),
        ethereum.Value.fromI32(32),
        ethereum.Value.fromI32(812739821),
      ]),
    ]);
    const secondNewPoolConfigurationSetEvent = createPoolConfigurationSetEvent(
      1,
      secondMarkets,
      now + 4000,
      now + 3000
    );
    handlePoolCreated(newPoolEvent);
    handleMarketCreated(newMarketRegisteredEvent);
    handleMarketCreated(newMarketRegisteredEvent2);
    handlePoolConfigurationSet(newPoolConfigurationSetEvent);
    assert.fieldEquals('Pool', '1', 'id', '1');
    assert.fieldEquals('Pool', '1', 'total_weight', '75');
    assert.fieldEquals('Pool', '1', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('Pool', '1', 'updated_at_block', (now + 2000).toString());
    assert.fieldEquals('Pool', '1', 'configurations', '[1-1, 1-2]');
    assert.fieldEquals('Pool', '1', 'total_weight', '75');
    assert.assertNull(store.get('Pool', '1')!.get('name'));
    assert.notInStore('Pool', '2');
    assert.fieldEquals('Market', '1', 'id', '1');
    assert.fieldEquals('Market', '1', 'configurations', '[1-1]');
    assert.fieldEquals('Market', '1', 'created_at', (now + 1000).toString());
    assert.fieldEquals('Market', '1', 'created_at_block', now.toString());
    assert.fieldEquals('Market', '1', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('Market', '1', 'updated_at_block', (now + 2000).toString());
    assert.fieldEquals('Market', '2', 'id', '2');
    assert.fieldEquals('Market', '2', 'configurations', '[1-2]');
    assert.fieldEquals('Market', '2', 'created_at', (now + 2000).toString());
    assert.fieldEquals('Market', '2', 'created_at_block', (now + 1000).toString());
    assert.fieldEquals('Market', '2', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('Market', '2', 'updated_at_block', (now + 2000).toString());
    assert.notInStore('Market', '3');
    assert.fieldEquals('MarketConfiguration', '1-1', 'id', '1-1');
    assert.fieldEquals('MarketConfiguration', '1-1', 'pool', '1');
    assert.fieldEquals('MarketConfiguration', '1-1', 'max_debt_share_value', '812739821');
    assert.fieldEquals('MarketConfiguration', '1-1', 'updated_at_block', (now + 2000).toString());
    assert.fieldEquals('MarketConfiguration', '1-1', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('MarketConfiguration', '1-1', 'created_at', (now + 3000).toString());
    assert.fieldEquals('MarketConfiguration', '1-1', 'created_at_block', (now + 2000).toString());
    assert.fieldEquals('MarketConfiguration', '1-1', 'market', '1');
    assert.fieldEquals('MarketConfiguration', '1-2', 'id', '1-2');
    assert.fieldEquals('MarketConfiguration', '1-2', 'market', '2');
    assert.fieldEquals('MarketConfiguration', '1-2', 'pool', '1');
    assert.fieldEquals('MarketConfiguration', '1-2', 'max_debt_share_value', '892379812');
    assert.fieldEquals('MarketConfiguration', '1-2', 'created_at', (now + 3000).toString());
    assert.fieldEquals('MarketConfiguration', '1-2', 'created_at_block', (now + 2000).toString());
    assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at_block', (now + 2000).toString());
    // Fire second event that should update all entities + remove the MarketConfigurations entities that
    // are not used anymore from the store
    handlePoolConfigurationSet(secondNewPoolConfigurationSetEvent);
    assert.notInStore('MarketConfiguration', '1-1');
    assert.fieldEquals('Pool', '1', 'total_weight', '32');
    assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at', (now + 4000).toString());
    assert.fieldEquals('MarketConfiguration', '1-2', 'updated_at_block', (now + 3000).toString());
    assert.notInStore('Pool', '2');
  });

  test('calculate net issuance', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newMarketRegisteredEvent = createMarketCreatedEvent(1, address, now, now - 1000);
    const arg = ethereum.Value.fromUnsignedBigInt(BigInt.fromU64(1));
    createMockedFunction(
      Address.fromString(defaultGraphContractAddress),
      'getMarketReportedDebt',
      'getMarketReportedDebt(uint128):(uint256)'
    )
      .withArgs([arg])
      .returns([ethereum.Value.fromI32(23)]);
    const newUsdDepositedEvent = createMarketUsdDepositedEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(200),
      now + 1000,
      now
    );
    const newUsdWithdrawnEvent = createMarketUsdWithdrawnEvent(
      1,
      Address.fromString(address2),
      BigInt.fromU64(300),
      now + 2000,
      now + 1000
    );
    handleMarketCreated(newMarketRegisteredEvent);
    handleMarketUsdDeposited(newUsdDepositedEvent);
    handleMarketUsdWithdrawn(newUsdWithdrawnEvent);
    assert.fieldEquals('Market', '1', 'address', address);
    assert.assertNull(store.get('Market', '1')!.get('configurations'));
    assert.fieldEquals('Market', '1', 'reported_debt', '23');
    assert.fieldEquals('Market', '1', 'usd_deposited', '200');
    assert.fieldEquals('Market', '1', 'usd_withdrawn', '300');
    assert.fieldEquals('Market', '1', 'net_issuance', '100');
    assert.fieldEquals('Market', '1', 'created_at', now.toString());
    assert.fieldEquals('Market', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Market', '1', 'updated_at', (now + 2000).toString());
    assert.fieldEquals('Market', '1', 'updated_at_block', (now + 1000).toString());
    assert.notInStore('Market', '2');
  });

  test('handleCollateralConfigured', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
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
    assert.assertNull(store.get('CollateralType', address)!.get('total_amount_deposited'));
    assert.notInStore('CollateralType', address2);
  });

  test('handleCollateralDeposit', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newCollateralConfiguredEvent = createCollateralConfiguredEvent(
      Address.fromString(address),
      true,
      BigInt.fromI32(200),
      BigInt.fromI32(50),
      BigInt.fromI32(90),
      Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(12))),
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
    handleCollateralConfigured(newCollateralConfiguredEvent);
    handleDeposited(newCollateralDepositEvent);
    assert.fieldEquals('CollateralType', address, 'id', address);
    assert.fieldEquals('CollateralType', address, 'created_at', now.toString());
    assert.fieldEquals('CollateralType', address, 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('CollateralType', address, 'updated_at', (now + 1000).toString());
    assert.fieldEquals('CollateralType', address, 'updated_at_block', now.toString());
    assert.fieldEquals('CollateralType', address, 'total_amount_deposited', '555');
    assert.fieldEquals('CollateralType', address, 'oracle_node_id', '12');
    handleDeposited(newCollateralDepositEvent);
    assert.fieldEquals('CollateralType', address, 'total_amount_deposited', '1110');
    assert.notInStore('CollateralType', address2);
  });

  test('handleCollateralWithdrawn', () => {
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
    handleDeposited(newCollateralDepositEvent);
    handleWithdrawn(newCollateralWithdrawnEvent);
    assert.fieldEquals('CollateralType', address, 'id', address);
    assert.fieldEquals('CollateralType', address, 'created_at', now.toString());
    assert.fieldEquals('CollateralType', address, 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('CollateralType', address, 'updated_at', (now + 2000).toString());
    assert.fieldEquals('CollateralType', address, 'updated_at_block', (now + 1000).toString());
    assert.fieldEquals('CollateralType', address, 'total_amount_deposited', '455');
    assert.fieldEquals('CollateralType', address, 'oracle_node_id', '13');
    assert.notInStore('CollateralType', address2);
  });

  test('handlePermissionGranted', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newAccountCreatedEvent = createAccountCreatedEvent(1, address, now, now - 1000);
    const newPermissionGrantedEvent = createPermissionGrantedEvent(
      1,
      Address.fromString(address),
      Bytes.fromByteArray(Bytes.fromI64(1234)),
      now + 1000,
      now
    );
    handleAccountCreated(newAccountCreatedEvent);
    handlePermissionGranted(newPermissionGrantedEvent);
    assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'id', `1-${address}`);
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'permissions',
      `[${Bytes.fromByteArray(Bytes.fromI64(1234)).toHex()}]`
    );
    assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'address', address);
    assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'account', '1');
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'created_at',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'created_at_block',
      now.toString()
    );
    assert.fieldEquals('Account', '1', 'permissions', `[1-${address}]`);
    assert.fieldEquals('Account', '1', 'created_at', now.toString());
    assert.fieldEquals('Account', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Account', '1', 'updated_at_block', now.toString());
    assert.fieldEquals('Account', '1', 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Account', '1', 'permissions', `[1-${address}]`);
    const newPermissionGrantedEvent2 = createPermissionGrantedEvent(
      1,
      Address.fromString(address),
      Bytes.fromByteArray(Bytes.fromI64(4321)),
      now + 2000,
      now + 1000
    );
    handlePermissionGranted(newPermissionGrantedEvent2);
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'permissions',
      `[${Bytes.fromByteArray(Bytes.fromI64(1234)).toHex()}, ${Bytes.fromByteArray(
        Bytes.fromI64(4321)
      ).toHex()}]`
    );
    assert.fieldEquals('Account', '1', 'updated_at_block', (now + 1000).toString());
    assert.fieldEquals('Account', '1', 'updated_at', (now + 2000).toString());
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'updated_at_block',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'updated_at',
      (now + 2000).toString()
    );
    assert.fieldEquals('Account', '1', 'permissions', `[1-${address}]`);
  });

  test('handlePermissionRevoked', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const newAccountCreatedEvent = createAccountCreatedEvent(1, address, now, now - 1000);
    handleAccountCreated(newAccountCreatedEvent);
    const newPermissionGrantedEvent = createPermissionGrantedEvent(
      1,
      Address.fromString(address),
      Bytes.fromByteArray(Bytes.fromI64(1234)),
      now + 1000,
      now
    );
    handlePermissionGranted(newPermissionGrantedEvent);
    const newPermissionGrantedEvent2 = createPermissionGrantedEvent(
      1,
      Address.fromString(address),
      Bytes.fromByteArray(Bytes.fromI64(1111)),
      now + 2000,
      now + 1000
    );
    handlePermissionGranted(newPermissionGrantedEvent2);
    const newPermissionRevokedEvent = createPermissionRevokedEvent(
      1,
      Address.fromString(address),
      Bytes.fromByteArray(ByteArray.fromHexString(Address.fromString(address).toHex())),
      now + 3000,
      now + 2000
    );
    handlePermissionRevoked(newPermissionRevokedEvent);
    assert.fieldEquals('AccountPermissionUsers', `1-${address}`, 'address', address);
    assert.fieldEquals('Account', '1', 'permissions', `[1-${address}]`);
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'created_at',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'created_at_block',
      now.toString()
    );
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'updated_at',
      (now + 3000).toString()
    );
    assert.fieldEquals(
      'AccountPermissionUsers',
      `1-${address}`,
      'updated_at_block',
      (now + 2000).toString()
    );
    assert.fieldEquals('Account', '1', 'created_at', now.toString());
    assert.fieldEquals('Account', '1', 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Account', '1', 'updated_at', (now + 3000).toString());
    assert.fieldEquals('Account', '1', 'updated_at_block', (now + 2000).toString());
    assert.notInStore(
      'AccountPermissionUsers',
      Bytes.fromByteArray(ByteArray.fromHexString(Address.fromString(address).toHex())).toString()
    );
  });

  test('handleDelegationUpdated', () => {
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
    assert.fieldEquals('Position', `1-1-${address}`, 'id', `1-1-${address}`);
    assert.fieldEquals('Position', `1-1-${address}`, 'created_at', now.toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'collateral_amount', '2323');
    assert.fieldEquals('Position', `1-1-${address}`, 'updated_at', now.toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'updated_at_block', (now - 1000).toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'c_ratio', '200');
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
    const newDelegatioNUpdatedEvent2 = createDelegationUpdateEvent(
      BigInt.fromI32(1),
      BigInt.fromI32(1),
      Address.fromString(address),
      BigInt.fromI32(10000),
      BigInt.fromI32(10),
      now + 1000,
      now
    );
    handleDelegationUpdated(newDelegatioNUpdatedEvent2);
    assert.fieldEquals('Position', `1-1-${address}`, 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'updated_at_block', now.toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'collateral_amount', '10000');
    assert.fieldEquals('Vault', `1-${address}`, 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Vault', `1-${address}`, 'updated_at_block', now.toString());
    assert.fieldEquals('Vault', `1-${address}`, 'collateral_amount', '-5354');
  });

  test('handleUSDMinted', () => {
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
    assert.fieldEquals('Position', `1-1-${address}`, 'id', `1-1-${address}`);
    assert.fieldEquals('Position', `1-1-${address}`, 'created_at', now.toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'collateral_amount', '2323');
    assert.fieldEquals('Position', `1-1-${address}`, 'updated_at', (now + 1000).toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'updated_at_block', now.toString());
    assert.fieldEquals('Position', `1-1-${address}`, 'c_ratio', '200');
    assert.fieldEquals('Position', `1-1-${address}`, 'leverage', '10');
    assert.fieldEquals('Position', `1-1-${address}`, 'total_minted', '2000');
    handleUSDMinted(newUSDMintedEvent);
    assert.fieldEquals('Position', `1-1-${address}`, 'total_minted', '4000');
  });

  test('handleUSDBurned', () => {
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
    assert.fieldEquals('Position', `1-1-${address}`, 'c_ratio', '200');
    assert.fieldEquals('Position', `1-1-${address}`, 'leverage', '10');
    assert.fieldEquals('Position', `1-1-${address}`, 'total_burned', '2000');
    handleUSDBurned(newUSDBurnedEvent);
    assert.fieldEquals('Position', `1-1-${address}`, 'total_burned', '4000');
  });

  test('handleRewardsDistributed', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const rewardsDistributedEvent = createRewardsDistributedEvent(
      BigInt.fromI32(1),
      Address.fromString(address),
      Address.fromString(address2),
      BigInt.fromI32(200),
      BigInt.fromI64(now),
      BigInt.fromI32(300),
      now,
      now - 1000
    );
    const rewardsDistributorRegisteredEvent = createRewardsDistributorRegisteredEvent(
      BigInt.fromI32(1),
      Address.fromString(address),
      Address.fromString(address2),
      now,
      now - 1000
    );
    handleRewardsDistributorRegistered(rewardsDistributorRegisteredEvent);
    handleRewardsDistributed(rewardsDistributedEvent);
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${now.toString()}-1`,
      'id',
      `${address2}-${now.toString()}-1`
    );
    assert.fieldEquals('RewardsDistribution', `${address2}-${now.toString()}-1`, 'amount', '200');
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${now.toString()}-1`,
      'collateral_type',
      address
    );
    assert.fieldEquals('RewardsDistribution', `${address2}-${now.toString()}-1`, 'pool', '1');
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${now.toString()}-1`,
      'start',
      now.toString()
    );
    assert.fieldEquals('RewardsDistribution', `${address2}-${now.toString()}-1`, 'duration', '300');
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${now.toString()}-1`,
      'created_at',
      now.toString()
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${now.toString()}-1`,
      'created_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${now.toString()}-1`,
      'updated_at',
      now.toString()
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${now.toString()}-1`,
      'updated_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals('RewardsDistribution', `${address2}-${now.toString()}-1`, 'pool', '1');
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'id',
      `1-${address}-${address2}`
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'created_at',
      now.toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'created_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'updated_at',
      now.toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'updated_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'distributor',
      address2
    );
    assert.fieldEquals('RewardsDistributor', address2, 'id', address2);
    assert.fieldEquals('RewardsDistributor', address2, 'total_distributed', '200');
    assert.fieldEquals('RewardsDistributor', address2, 'created_at', now.toString());
    assert.fieldEquals('RewardsDistributor', address2, 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('RewardsDistributor', address2, 'updated_at', now.toString());
    assert.fieldEquals('RewardsDistributor', address2, 'updated_at_block', (now - 1000).toString());
    assert.assertNull(
      store.get('AccountRewardsDistributor', `1-${address}-${address2}`)!.get('total_claimed')
    );
    const rewardsDistributedEvent2 = createRewardsDistributedEvent(
      BigInt.fromI32(1),
      Address.fromString(address),
      Address.fromString(address2),
      BigInt.fromI32(500),
      BigInt.fromI64(now + 1000),
      BigInt.fromI32(1000),
      now + 1000,
      now,
      2
    );
    handleRewardsDistributed(rewardsDistributedEvent2);
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'id',
      `${address2}-${(now + 1000).toString()}-2`
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'amount',
      '500'
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'collateral_type',
      address
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'pool',
      '1'
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'start',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'duration',
      '1000'
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'created_at',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'created_at_block',
      (now + 1000 - 1000).toString()
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'updated_at',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'updated_at_block',
      (now + 1000 - 1000).toString()
    );
    assert.fieldEquals(
      'RewardsDistribution',
      `${address2}-${(now + 1000).toString()}-2`,
      'pool',
      '1'
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'id',
      `1-${address}-${address2}`
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'created_at',
      now.toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'created_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'updated_at',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'updated_at_block',
      now.toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `1-${address}-${address2}`,
      'distributor',
      address2
    );
    assert.assertNull(
      store.get('AccountRewardsDistributor', `1-${address}-${address2}`)!.get('total_claimed')
    );
    assert.fieldEquals('RewardsDistributor', address2, 'total_distributed', '700');
    assert.fieldEquals('RewardsDistributor', address2, 'updated_at', (now + 1000).toString());
    assert.fieldEquals('RewardsDistributor', address2, 'updated_at_block', now.toString());
  });

  test('handleRewardsClaimed', () => {
    // Needs to be here because of Closures
    const now = new Date(1668448739566).getTime();
    const rewardsClaimed = createRewardsClaimedEvent(
      BigInt.fromI32(1),
      BigInt.fromI32(2),
      Address.fromString(address),
      Address.fromString(address2),
      BigInt.fromI32(500),
      now,
      now - 1000
    );
    const rewardsDistributedEvent = createRewardsDistributedEvent(
      BigInt.fromI32(2),
      Address.fromString(address),
      Address.fromString(address2),
      BigInt.fromI32(200),
      BigInt.fromI64(now),
      BigInt.fromI32(300),
      now,
      now - 1000
    );
    const rewardsDistributorRegisteredEvent = createRewardsDistributorRegisteredEvent(
      BigInt.fromI32(1),
      Address.fromString(address),
      Address.fromString(address2),
      now,
      now - 1000
    );
    handleRewardsDistributorRegistered(rewardsDistributorRegisteredEvent);
    handleRewardsDistributed(rewardsDistributedEvent);
    assert.assertNull(
      store.get('AccountRewardsDistributor', `2-${address}-${address2}`)!.get('total_claimed')
    );

    assert.fieldEquals('RewardsDistributor', address2, 'id', address2);
    assert.fieldEquals('RewardsDistributor', address2, 'total_distributed', '200');
    assert.fieldEquals('RewardsDistributor', address2, 'created_at', now.toString());
    assert.fieldEquals('RewardsDistributor', address2, 'created_at_block', (now - 1000).toString());
    assert.fieldEquals('RewardsDistributor', address2, 'updated_at', now.toString());
    assert.fieldEquals('RewardsDistributor', address2, 'updated_at_block', (now - 1000).toString());

    handleRewardsClaimed(rewardsClaimed);
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'id', `${address2}-${now}-1`);
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'created_at', now.toString());
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${now}-1`,
      'created_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'account', '1');
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'pool', '2');
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'collateral_type', address);
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'distributor', address2);
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'amount', '500');
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'updated_at', now.toString());
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${now}-1`,
      'updated_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'distributor', address2);
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'created_at',
      now.toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'created_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'updated_at',
      now.toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'updated_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'total_claimed',
      '500'
    );
    const rewardsClaimed2 = createRewardsClaimedEvent(
      BigInt.fromI32(1),
      BigInt.fromI32(2),
      Address.fromString(address),
      Address.fromString(address2),
      BigInt.fromI32(800),
      now + 1000,
      now,
      2
    );
    handleRewardsClaimed(rewardsClaimed2);
    assert.fieldEquals('RewardsDistributor', address2, 'total_distributed', '200');
    assert.fieldEquals('RewardsDistributor', address2, 'total_claimed', '1300');
    assert.fieldEquals('RewardsDistributor', address2, 'updated_at', (now + 1000).toString());
    assert.fieldEquals('RewardsDistributor', address2, 'updated_at_block', now.toString());
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'id',
      `${address2}-${(now + 1000).toString()}-2`
    );
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'created_at',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'created_at_block',
      now.toString()
    );
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'account',
      '1'
    );
    assert.fieldEquals('RewardsClaimed', `${address2}-${(now + 1000).toString()}-2`, 'pool', '2');
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'collateral_type',
      address
    );
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'distributor',
      address2
    );
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'amount',
      '800'
    );
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'updated_at',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'RewardsClaimed',
      `${address2}-${(now + 1000).toString()}-2`,
      'updated_at_block',
      now.toString()
    );
    assert.fieldEquals('RewardsClaimed', `${address2}-${now}-1`, 'distributor', address2);
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'created_at',
      now.toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'created_at_block',
      (now - 1000).toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'updated_at',
      (now + 1000).toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'updated_at_block',
      now.toString()
    );
    assert.fieldEquals(
      'AccountRewardsDistributor',
      `2-${address}-${address2}`,
      'total_claimed',
      '1300'
    );
  });

  test('handleLiquidation', () => {
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
  });
  test('handleVaultLiquidation', () => {
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
  });
});
