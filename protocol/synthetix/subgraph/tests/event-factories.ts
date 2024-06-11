import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import {
  AccountCreated,
  CollateralConfigured,
  DelegationUpdated,
  Deposited,
  Liquidation,
  PermissionGranted,
  PermissionRevoked,
  PoolConfigurationSet,
  PoolCreated,
  PoolNameUpdated,
  PoolNominationRenounced,
  PoolNominationRevoked,
  PoolOwnerNominated,
  MarketRegistered,
  PoolOwnershipAccepted,
  RewardsClaimed,
  RewardsDistributed,
  RewardsDistributorRegistered,
  RewardsDistributorRemoved,
  UsdBurned,
  UsdMinted,
  VaultLiquidation,
  Withdrawn,
  MarketUsdDeposited,
  MarketUsdWithdrawn,
} from '../mainnet/generated/CoreProxy/CoreProxy';
import { address } from './constants';

function createBlock(timestamp: i64, blockNumber: i64): Map<string, i64> {
  const newBlock = new Map<string, i64>();
  newBlock.set('timestamp', timestamp);
  newBlock.set('blockNumber', blockNumber);
  return newBlock;
}

export function createPoolCreatedEvent(
  id: i32,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): PoolCreated {
  const newPoolCreatedEvent = newTypedMockEvent<PoolCreated>();
  const block = createBlock(timestamp, blockNumber);
  newPoolCreatedEvent.parameters = [];
  newPoolCreatedEvent.parameters.push(new ethereum.EventParam('id', ethereum.Value.fromI32(id)));
  newPoolCreatedEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  newPoolCreatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolCreatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolCreatedEvent;
}

export function createPoolOwnerNominatedEvent(
  id: i32,
  nominee: string,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): PoolOwnerNominated {
  const newCreateNominatedPoolOwnerEvent = newTypedMockEvent<PoolOwnerNominated>();
  const block = createBlock(timestamp, blockNumber);
  newCreateNominatedPoolOwnerEvent.parameters = [];
  newCreateNominatedPoolOwnerEvent.parameters.push(
    new ethereum.EventParam('id', ethereum.Value.fromI32(id))
  );
  newCreateNominatedPoolOwnerEvent.parameters.push(
    new ethereum.EventParam(
      'nominatedOwner',
      ethereum.Value.fromAddress(Address.fromString(nominee))
    )
  );
  newCreateNominatedPoolOwnerEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  newCreateNominatedPoolOwnerEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newCreateNominatedPoolOwnerEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newCreateNominatedPoolOwnerEvent;
}

export function createPoolNameUpdatedEvent(
  id: i32,
  name: string,
  timestamp: i64,
  blockNumber: i64
): PoolNameUpdated {
  const newPoolNameUpdatedEvent = newTypedMockEvent<PoolNameUpdated>();
  const block = createBlock(timestamp, blockNumber);
  newPoolNameUpdatedEvent.parameters = [];
  newPoolNameUpdatedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolNameUpdatedEvent.parameters.push(
    new ethereum.EventParam('name', ethereum.Value.fromString(name))
  );
  newPoolNameUpdatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolNameUpdatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolNameUpdatedEvent;
}

export function createPoolOwnershipAcceptedEvent(
  id: i32,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): PoolOwnershipAccepted {
  const newPoolOwnershipAcceptedEvent = newTypedMockEvent<PoolOwnershipAccepted>();
  const block = createBlock(timestamp, blockNumber);
  newPoolOwnershipAcceptedEvent.parameters = [];
  newPoolOwnershipAcceptedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolOwnershipAcceptedEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  newPoolOwnershipAcceptedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolOwnershipAcceptedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolOwnershipAcceptedEvent;
}

export function createPoolNominationRevokedEvent(
  id: i32,
  timestamp: i64,
  blockNumber: i64
): PoolNominationRevoked {
  const newPoolNominationRevokedEvent = newTypedMockEvent<PoolNominationRevoked>();
  const block = createBlock(timestamp, blockNumber);
  newPoolNominationRevokedEvent.parameters = [];
  newPoolNominationRevokedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolNominationRevokedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolNominationRevokedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolNominationRevokedEvent;
}

export function createPoolOwnershipRenouncedEvent(
  id: i32,
  timestamp: i64,
  blockNumber: i64
): PoolNominationRenounced {
  const newPoolOwnerNominationRenouncedEvent = newTypedMockEvent<PoolNominationRenounced>();
  const block = createBlock(timestamp, blockNumber);
  newPoolOwnerNominationRenouncedEvent.parameters = [];
  newPoolOwnerNominationRenouncedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolOwnerNominationRenouncedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolOwnerNominationRenouncedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolOwnerNominationRenouncedEvent;
}

export function createAccountCreatedEvent(
  id: i32,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): AccountCreated {
  const newMarketRegisteredEvent = newTypedMockEvent<AccountCreated>();
  const block = createBlock(timestamp, blockNumber);
  newMarketRegisteredEvent.parameters = [];

  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromI32(id))
  );
  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(Address.fromString(owner)))
  );
  newMarketRegisteredEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newMarketRegisteredEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newMarketRegisteredEvent;
}

export function createPoolConfigurationSetEvent(
  poolId: i32,
  marketConfigs: Array<ethereum.Tuple>,
  timestamp: i64,
  blockNumber: i64
): PoolConfigurationSet {
  const newMarketRegisteredEvent = newTypedMockEvent<PoolConfigurationSet>();
  const block = createBlock(timestamp, blockNumber);
  newMarketRegisteredEvent.parameters = [];
  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('markets', ethereum.Value.fromTupleArray(marketConfigs))
  );

  newMarketRegisteredEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newMarketRegisteredEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newMarketRegisteredEvent;
}

export function createCollateralConfiguredEvent(
  collateralType: string,
  depositingEnabled: boolean,
  issuanceRatio: i32,
  liquidationRatio: i32,
  liquidationReward: i32,
  oracleNodeId: i32,
  minDelegation: i32,
  timestamp: i64,
  blockNumber: i64
): CollateralConfigured {
  const newUsdWithdrawnEvent = newTypedMockEvent<CollateralConfigured>();
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = [];
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromBoolean(depositingEnabled),
    ethereum.Value.fromI32(issuanceRatio),
    ethereum.Value.fromI32(liquidationRatio),
    ethereum.Value.fromI32(liquidationReward),
    ethereum.Value.fromBytes(Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(oracleNodeId)))),
    ethereum.Value.fromAddress(Address.fromString(address)),
    ethereum.Value.fromI32(minDelegation),
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);
  newUsdWithdrawnEvent.parameters.push(new ethereum.EventParam('config', tupleValue));
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createDepositEvent(
  accountId: i64,
  collateralType: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64
): Deposited {
  const newUsdWithdrawnEvent = newTypedMockEvent<Deposited>();
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = [];
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromSignedBigInt(BigInt.fromI64(accountId)))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createWithdrawnEvent(
  accountId: i64,
  collateralType: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64
): Withdrawn {
  const newUsdWithdrawnEvent = newTypedMockEvent<Withdrawn>();
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = [];
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromSignedBigInt(BigInt.fromI64(accountId)))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createPermissionGrantedEvent(
  accountId: i64,
  user: string,
  permissions: i64,
  timestamp: i64,
  blockNumber: i64
): PermissionGranted {
  const newUsdWithdrawnEvent = newTypedMockEvent<PermissionGranted>();
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = [];
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromSignedBigInt(BigInt.fromI64(accountId)))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      'permissions',
      ethereum.Value.fromBytes(Bytes.fromByteArray(Bytes.fromI64(permissions)))
    )
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString(user)))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createPermissionRevokedEvent(
  accountId: i64,
  user: string,
  permissions: i64,
  timestamp: i64,
  blockNumber: i64
): PermissionRevoked {
  const newUsdWithdrawnEvent = newTypedMockEvent<PermissionRevoked>();
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = [];
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromSignedBigInt(BigInt.fromI64(accountId)))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      'permissions',
      ethereum.Value.fromBytes(Bytes.fromByteArray(Bytes.fromI64(permissions)))
    )
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('user', ethereum.Value.fromAddress(Address.fromString(user)))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createDelegationUpdateEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  amount: i64,
  leverage: i32,
  timestamp: i64,
  blockNumber: i64
): DelegationUpdated {
  const newDelegationUpdatedEvent = newTypedMockEvent<DelegationUpdated>();
  const block = createBlock(timestamp, blockNumber);
  newDelegationUpdatedEvent.parameters = [];
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('leverage', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(leverage)))
  );
  newDelegationUpdatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newDelegationUpdatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newDelegationUpdatedEvent;
}

export function createUSDMintedEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64
): UsdMinted {
  const newUSDMintedEvent = newTypedMockEvent<UsdMinted>();
  const block = createBlock(timestamp, blockNumber);
  newUSDMintedEvent.parameters = [];
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newUSDMintedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUSDMintedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUSDMintedEvent;
}

export function createUSDBurnedEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64
): UsdBurned {
  const newUSDBurnedEvent = newTypedMockEvent<UsdBurned>();
  const block = createBlock(timestamp, blockNumber);
  newUSDBurnedEvent.parameters = [];
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newUSDBurnedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUSDBurnedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUSDBurnedEvent;
}

export function createRewardsDistributorRegisteredEvent(
  poolId: i32,
  collateralType: string,
  distributor: string,
  timestamp: i64,
  blockNumber: i64
): RewardsDistributorRegistered {
  const newRewardsDistributorRegisteredEvent = newTypedMockEvent<RewardsDistributorRegistered>();
  const block = createBlock(timestamp, blockNumber);
  newRewardsDistributorRegisteredEvent.parameters = [];
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromAddress(Address.fromString(distributor)))
  );
  newRewardsDistributorRegisteredEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsDistributorRegisteredEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsDistributorRegisteredEvent;
}

export function createRewardsDistributorRemovedEvent(
  poolId: i32,
  collateralType: string,
  distributor: string,
  timestamp: i64,
  blockNumber: i64
): RewardsDistributorRemoved {
  const newRewardsDistributorRemovedEvent = newTypedMockEvent<RewardsDistributorRemoved>();
  const block = createBlock(timestamp, blockNumber);
  newRewardsDistributorRemovedEvent.parameters = [];
  newRewardsDistributorRemovedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newRewardsDistributorRemovedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newRewardsDistributorRemovedEvent.parameters.push(
    new ethereum.EventParam(
      'distributor',
      ethereum.Value.fromAddress(Address.fromString(distributor))
    )
  );

  newRewardsDistributorRemovedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsDistributorRemovedEvent.block.number = BigInt.fromI64(block['blockNumber']);

  return newRewardsDistributorRemovedEvent;
}

export function createRewardsDistributedEvent(
  poolId: i32,
  collateralType: string,
  distributor: string,
  amount: i64,
  start: i64,
  duration: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): RewardsDistributed {
  const newRewardsDistributedEvent = newTypedMockEvent<RewardsDistributed>();
  const block = createBlock(timestamp, blockNumber);
  newRewardsDistributedEvent.logIndex = BigInt.fromI32(logIndex);
  newRewardsDistributedEvent.parameters = [];
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam(
      'distributor',
      ethereum.Value.fromAddress(Address.fromString(distributor))
    )
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('start', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(start)))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('duration', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(duration)))
  );
  newRewardsDistributedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsDistributedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsDistributedEvent;
}

export function createRewardsClaimedEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  distributor: string,
  amount: i64,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): RewardsClaimed {
  const newRewardsClaimedEvent = newTypedMockEvent<RewardsClaimed>();
  const block = createBlock(timestamp, blockNumber);
  newRewardsClaimedEvent.logIndex = BigInt.fromI32(logIndex);
  newRewardsClaimedEvent.parameters = [];
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam(
      'distributor',
      ethereum.Value.fromAddress(Address.fromString(distributor))
    )
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  newRewardsClaimedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsClaimedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsClaimedEvent;
}

export function createLiquidationEvent(
  accountId: i64,
  poolId: i32,
  collateralType: string,
  debtLiquidated: i64,
  collateralLiquidated: i64,
  amountRewarded: i64,
  liquidateAsAccountId: i64,
  sender: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): Liquidation {
  const newLiquidatedEvent = newTypedMockEvent<Liquidation>();
  const block = createBlock(timestamp, blockNumber);
  newLiquidatedEvent.logIndex = BigInt.fromI32(logIndex);
  newLiquidatedEvent.parameters = [];
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam(
      'accountId',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(accountId))
    )
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(debtLiquidated)),
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(collateralLiquidated)),
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(amountRewarded)),
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);
  newLiquidatedEvent.parameters.push(new ethereum.EventParam('liquidationData', tupleValue));
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam(
      'liquidateAsAccountId',
      ethereum.Value.fromSignedBigInt(BigInt.fromI64(liquidateAsAccountId))
    )
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );
  newLiquidatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newLiquidatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newLiquidatedEvent;
}

export function createVaultLiquidationEvent(
  poolId: i32,
  collateralType: string,
  debtLiquidated: i64,
  collateralLiquidated: i64,
  amountRewarded: i64,
  liquidateAsAccountId: i64,
  sender: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): VaultLiquidation {
  const newVaultLiquidationEvent = newTypedMockEvent<VaultLiquidation>();
  const block = createBlock(timestamp, blockNumber);
  newVaultLiquidationEvent.logIndex = BigInt.fromI32(logIndex);
  newVaultLiquidationEvent.parameters = [];
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(poolId))
  );
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam(
      'collateralType',
      ethereum.Value.fromAddress(Address.fromString(collateralType))
    )
  );
  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(debtLiquidated)),
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(collateralLiquidated)),
    ethereum.Value.fromSignedBigInt(BigInt.fromI64(amountRewarded)),
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);
  newVaultLiquidationEvent.parameters.push(new ethereum.EventParam('liquidationData', tupleValue));
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam(
      'liquidateAsAccountId',
      ethereum.Value.fromSignedBigInt(BigInt.fromI64(liquidateAsAccountId))
    )
  );
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );
  newVaultLiquidationEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newVaultLiquidationEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newVaultLiquidationEvent;
}

export function createMarketRegisteredEvent(
  market: string,
  marketId: i32,
  sender: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32
): MarketRegistered {
  const event = newTypedMockEvent<MarketRegistered>();

  event.parameters.push(
    new ethereum.EventParam('market', ethereum.Value.fromAddress(Address.fromString(market)))
  );
  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(Address.fromString(sender)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}

export function createMarketUsdDepositedEvent(
  marketId: i32,
  target: string,
  amount: i64,
  market: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32
): MarketUsdDeposited {
  const event = newTypedMockEvent<MarketUsdDeposited>();

  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam('target', ethereum.Value.fromAddress(Address.fromString(target)))
  );
  event.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  event.parameters.push(
    new ethereum.EventParam('market', ethereum.Value.fromAddress(Address.fromString(market)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}

export function createMarketUsdWithdrawnEvent(
  marketId: i32,
  target: string,
  amount: i64,
  market: string,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32
): MarketUsdWithdrawn {
  const event = newTypedMockEvent<MarketUsdWithdrawn>();

  event.parameters.push(new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId)));
  event.parameters.push(
    new ethereum.EventParam('target', ethereum.Value.fromAddress(Address.fromString(target)))
  );
  event.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount)))
  );
  event.parameters.push(
    new ethereum.EventParam('market', ethereum.Value.fromAddress(Address.fromString(market)))
  );

  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  event.logIndex = BigInt.fromI64(logIndex);

  return event;
}
