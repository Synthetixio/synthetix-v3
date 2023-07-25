import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as';
import {
  AccountCreated,
  CollateralConfigured,
  DelegationUpdated,
  Deposited,
  Liquidation,
  MarketRegistered,
  MarketUsdDeposited,
  MarketUsdWithdrawn,
  PermissionGranted,
  PermissionRevoked,
  PoolConfigurationSet,
  PoolCreated,
  PoolNameUpdated,
  PoolNominationRenounced,
  PoolNominationRevoked,
  PoolOwnerNominated,
  PoolOwnershipAccepted,
  RewardsClaimed,
  RewardsDistributed,
  RewardsDistributorRegistered,
  UsdBurned,
  UsdMinted,
  VaultLiquidation,
  Withdrawn,
} from '../generated/CoreProxy/CoreProxy';
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
  const newPoolCreatedEvent = changetype<PoolCreated>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newPoolCreatedEvent.parameters = new Array();
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
  const newCreateNominatedPoolOwnerEvent = changetype<PoolOwnerNominated>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newCreateNominatedPoolOwnerEvent.parameters = new Array();
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
  const newPoolNameUpdatedEvent = changetype<PoolNameUpdated>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newPoolNameUpdatedEvent.parameters = new Array();
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
  const newPoolOwnershipAcceptedEvent = changetype<PoolOwnershipAccepted>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newPoolOwnershipAcceptedEvent.parameters = new Array();
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
  const newPoolNominationRevokedEvent = changetype<PoolNominationRevoked>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newPoolNominationRevokedEvent.parameters = new Array();
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
  const newPoolOwnerNominationRenouncedEvent = changetype<PoolNominationRenounced>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newPoolOwnerNominationRenouncedEvent.parameters = new Array();
  newPoolOwnerNominationRenouncedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromI32(id))
  );
  newPoolOwnerNominationRenouncedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newPoolOwnerNominationRenouncedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newPoolOwnerNominationRenouncedEvent;
}

export function createMarketCreatedEvent(
  id: i32,
  market: string,
  timestamp: i64,
  blockNumber: i64
): MarketRegistered {
  const newMarketRegisteredEvent = changetype<MarketRegistered>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newMarketRegisteredEvent.parameters = new Array();
  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('market', ethereum.Value.fromAddress(Address.fromString(market)))
  );
  newMarketRegisteredEvent.parameters.push(
    new ethereum.EventParam('marketId', ethereum.Value.fromI32(id))
  );
  newMarketRegisteredEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newMarketRegisteredEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newMarketRegisteredEvent;
}

export function createAccountCreatedEvent(
  id: i32,
  owner: string,
  timestamp: i64,
  blockNumber: i64
): AccountCreated {
  const newMarketRegisteredEvent = changetype<AccountCreated>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newMarketRegisteredEvent.parameters = new Array();

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
  const newMarketRegisteredEvent = changetype<PoolConfigurationSet>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newMarketRegisteredEvent.parameters = new Array();
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

export function createMarketUsdDepositedEvent(
  marketId: i32,
  target: Address,
  amount: BigInt,
  timestamp: i64,
  blockNumber: i64
): MarketUsdDeposited {
  const newUsdMintedEvent = changetype<MarketUsdDeposited>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUsdMintedEvent.parameters = new Array();
  newUsdMintedEvent.parameters.push(
    new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId))
  );
  newUsdMintedEvent.parameters.push(
    new ethereum.EventParam('target', ethereum.Value.fromAddress(target))
  );
  newUsdMintedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newUsdMintedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdMintedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdMintedEvent;
}

export function createMarketUsdWithdrawnEvent(
  marketId: i32,
  target: Address,
  amount: BigInt,
  timestamp: i64,
  blockNumber: i64
): MarketUsdWithdrawn {
  const newUsdWithdrawnEvent = changetype<MarketUsdWithdrawn>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = new Array();
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('marketId', ethereum.Value.fromI32(marketId))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('target', ethereum.Value.fromAddress(target))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createCollateralConfiguredEvent(
  collateralType: Address,
  depositingEnabled: boolean,
  issuanceRatio: BigInt,
  liquidationRatio: BigInt,
  liquidationReward: BigInt,
  oracleNodeId: Bytes,
  minDelegation: BigInt,
  timestamp: i64,
  blockNumber: i64
): CollateralConfigured {
  const newUsdWithdrawnEvent = changetype<CollateralConfigured>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = new Array();
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromBoolean(depositingEnabled),
    ethereum.Value.fromSignedBigInt(issuanceRatio),
    ethereum.Value.fromSignedBigInt(liquidationRatio),
    ethereum.Value.fromSignedBigInt(liquidationReward),
    ethereum.Value.fromBytes(oracleNodeId),
    ethereum.Value.fromAddress(Address.fromString(address)),
    ethereum.Value.fromSignedBigInt(minDelegation),
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);
  newUsdWithdrawnEvent.parameters.push(new ethereum.EventParam('config', tupleValue));
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createDepositEvent(
  accountId: i32,
  collateralType: Address,
  amount: BigInt,
  timestamp: i64,
  blockNumber: i64
): Deposited {
  const newUsdWithdrawnEvent = changetype<Deposited>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = new Array();
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromI32(accountId))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createWithdrawnEvent(
  accountId: i32,
  collateralType: Address,
  amount: BigInt,
  timestamp: i64,
  blockNumber: i64
): Withdrawn {
  const newUsdWithdrawnEvent = changetype<Withdrawn>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = new Array();
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromI32(accountId))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createPermissionGrantedEvent(
  accountId: i32,
  user: Address,
  permissions: Bytes,
  timestamp: i64,
  blockNumber: i64
): PermissionGranted {
  const newUsdWithdrawnEvent = changetype<PermissionGranted>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = new Array();
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromI32(accountId))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('permissions', ethereum.Value.fromBytes(permissions))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('user', ethereum.Value.fromAddress(user))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createPermissionRevokedEvent(
  accountId: i32,
  user: Address,
  permissions: Bytes,
  timestamp: i64,
  blockNumber: i64
): PermissionRevoked {
  const newUsdWithdrawnEvent = changetype<PermissionRevoked>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUsdWithdrawnEvent.parameters = new Array();
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromI32(accountId))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('permissions', ethereum.Value.fromBytes(permissions))
  );
  newUsdWithdrawnEvent.parameters.push(
    new ethereum.EventParam('user', ethereum.Value.fromAddress(user))
  );
  newUsdWithdrawnEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUsdWithdrawnEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUsdWithdrawnEvent;
}

export function createDelegationUpdateEvent(
  accountId: BigInt,
  poolId: BigInt,
  collateralType: Address,
  amount: BigInt,
  leverage: BigInt,
  timestamp: i64,
  blockNumber: i64
): DelegationUpdated {
  const newDelegationUpdatedEvent = changetype<DelegationUpdated>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newDelegationUpdatedEvent.parameters = new Array();
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromUnsignedBigInt(accountId))
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromUnsignedBigInt(poolId))
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newDelegationUpdatedEvent.parameters.push(
    new ethereum.EventParam('leverage', ethereum.Value.fromUnsignedBigInt(leverage))
  );
  newDelegationUpdatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newDelegationUpdatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newDelegationUpdatedEvent;
}

export function createUSDMintedEvent(
  accountId: BigInt,
  poolId: BigInt,
  collateralType: Address,
  amount: BigInt,
  timestamp: i64,
  blockNumber: i64
): UsdMinted {
  const newUSDMintedEvent = changetype<UsdMinted>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUSDMintedEvent.parameters = new Array();
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromUnsignedBigInt(accountId))
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromUnsignedBigInt(poolId))
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  newUSDMintedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newUSDMintedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUSDMintedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUSDMintedEvent;
}

export function createUSDBurnedEvent(
  accountId: BigInt,
  poolId: BigInt,
  collateralType: Address,
  amount: BigInt,
  timestamp: i64,
  blockNumber: i64
): UsdBurned {
  const newUSDBurnedEvent = changetype<UsdBurned>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newUSDBurnedEvent.parameters = new Array();
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromUnsignedBigInt(accountId))
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromUnsignedBigInt(poolId))
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  newUSDBurnedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newUSDBurnedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newUSDBurnedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newUSDBurnedEvent;
}

export function createRewardsDistributorRegisteredEvent(
  poolId: BigInt,
  collateralType: Address,
  distributor: Address,
  timestamp: i64,
  blockNumber: i64
): RewardsDistributorRegistered {
  const newRewardsDistributorRegisteredEvent = changetype<RewardsDistributorRegistered>(
    newMockEvent()
  );
  const block = createBlock(timestamp, blockNumber);
  newRewardsDistributorRegisteredEvent.parameters = new Array();
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromUnsignedBigInt(poolId))
  );
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  newRewardsDistributorRegisteredEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromAddress(distributor))
  );
  newRewardsDistributorRegisteredEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsDistributorRegisteredEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsDistributorRegisteredEvent;
}

export function createRewardsDistributedEvent(
  poolId: BigInt,
  collateralType: Address,
  distributor: Address,
  amount: BigInt,
  start: BigInt,
  duration: BigInt,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): RewardsDistributed {
  const newRewardsDistributedEvent = changetype<RewardsDistributed>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newRewardsDistributedEvent.logIndex = BigInt.fromI32(logIndex);
  newRewardsDistributedEvent.parameters = new Array();
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromUnsignedBigInt(poolId))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('distributor', ethereum.Value.fromAddress(distributor))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('start', ethereum.Value.fromUnsignedBigInt(start))
  );
  newRewardsDistributedEvent.parameters.push(
    new ethereum.EventParam('duration', ethereum.Value.fromUnsignedBigInt(duration))
  );
  newRewardsDistributedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsDistributedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsDistributedEvent;
}

export function createRewardsClaimedEvent(
  accountId: BigInt,
  poolId: BigInt,
  collateralType: Address,
  distributor: Address,
  amount: BigInt,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): RewardsClaimed {
  const newRewardsClaimedEvent = changetype<RewardsClaimed>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newRewardsClaimedEvent.logIndex = BigInt.fromI32(logIndex);
  newRewardsClaimedEvent.parameters = new Array();
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromUnsignedBigInt(accountId))
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromUnsignedBigInt(poolId))
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('distributor', ethereum.Value.fromAddress(distributor))
  );
  newRewardsClaimedEvent.parameters.push(
    new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount))
  );
  newRewardsClaimedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newRewardsClaimedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newRewardsClaimedEvent;
}

export function createLiquidationEvent(
  accountId: BigInt,
  poolId: BigInt,
  collateralType: Address,
  debtLiquidated: BigInt,
  collateralLiquidated: BigInt,
  amountRewarded: BigInt,
  liquidateAsAccountId: BigInt,
  sender: Address,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): Liquidation {
  const newLiquidatedEvent = changetype<Liquidation>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newLiquidatedEvent.logIndex = BigInt.fromI32(logIndex);
  newLiquidatedEvent.parameters = new Array();
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam('accountId', ethereum.Value.fromUnsignedBigInt(accountId))
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromUnsignedBigInt(poolId))
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromSignedBigInt(debtLiquidated),
    ethereum.Value.fromSignedBigInt(collateralLiquidated),
    ethereum.Value.fromSignedBigInt(amountRewarded),
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);
  newLiquidatedEvent.parameters.push(new ethereum.EventParam('liquidationData', tupleValue));
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam(
      'liquidateAsAccountId',
      ethereum.Value.fromSignedBigInt(liquidateAsAccountId)
    )
  );
  newLiquidatedEvent.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(sender))
  );
  newLiquidatedEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newLiquidatedEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newLiquidatedEvent;
}

export function createVaultLiquidationEvent(
  poolId: BigInt,
  collateralType: Address,
  debtLiquidated: BigInt,
  collateralLiquidated: BigInt,
  amountRewarded: BigInt,
  liquidateAsAccountId: BigInt,
  sender: Address,
  timestamp: i64,
  blockNumber: i64,
  logIndex: i32 = 1
): VaultLiquidation {
  const newVaultLiquidationEvent = changetype<VaultLiquidation>(newMockEvent());
  const block = createBlock(timestamp, blockNumber);
  newVaultLiquidationEvent.logIndex = BigInt.fromI32(logIndex);
  newVaultLiquidationEvent.parameters = new Array();
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam('poolId', ethereum.Value.fromUnsignedBigInt(poolId))
  );
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam('collateralType', ethereum.Value.fromAddress(collateralType))
  );
  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromSignedBigInt(debtLiquidated),
    ethereum.Value.fromSignedBigInt(collateralLiquidated),
    ethereum.Value.fromSignedBigInt(amountRewarded),
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);
  newVaultLiquidationEvent.parameters.push(new ethereum.EventParam('liquidationData', tupleValue));
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam(
      'liquidateAsAccountId',
      ethereum.Value.fromSignedBigInt(liquidateAsAccountId)
    )
  );
  newVaultLiquidationEvent.parameters.push(
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(sender))
  );
  newVaultLiquidationEvent.block.timestamp = BigInt.fromI64(block['timestamp']);
  newVaultLiquidationEvent.block.number = BigInt.fromI64(block['blockNumber']);
  return newVaultLiquidationEvent;
}
