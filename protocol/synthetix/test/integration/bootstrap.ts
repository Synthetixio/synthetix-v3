import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { createOracleNode } from '@synthetixio/oracle-manager/test/integration/bootstrap';
import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { ethers } from 'ethers';
import { depositAmount, stake } from './bootstrapStakers';
import { wei } from '@synthetixio/wei';
import hre from 'hardhat';
import { MockMarket } from '../../typechain-types/contracts/mocks/MockMarket';

import type {
  AccountProxy,
  CoreProxy,
  USDProxy,
  CollateralMock,
  Oracle_managerProxy,
} from '../generated/typechain';

const POOL_FEATURE_FLAG = ethers.utils.formatBytes32String('createPool');
const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

export interface Proxies {
  AccountProxy: AccountProxy;
  CoreProxy: CoreProxy;
  USDProxy: USDProxy;
  CollateralMock: CollateralMock;
  ['oracle_manager.Proxy']: Oracle_managerProxy;
}

export interface Systems {
  Account: AccountProxy;
  Core: CoreProxy;
  USD: USDProxy;
  CollateralMock: CollateralMock;
  OracleManager: Oracle_managerProxy;
}

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Proxies>({
  cannonfile: 'cannonfile.test.toml',
});

const restoreSnapshot = createSnapshot();

export function bootstrap() {
  let systems: Systems;

  before('load system proxies', function () {
    systems = {
      Account: getContract('AccountProxy'),
      Core: getContract('CoreProxy'),
      USD: getContract('USDProxy'),
      OracleManager: getContract('oracle_manager.Proxy'),
      CollateralMock: getContract('CollateralMock'),
    } as Systems;
  });

  before(restoreSnapshot);

  return {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getSigners()[0],
    systems: () => systems,
  };
}

export function bootstrapWithStakedPool(
  r: ReturnType<typeof bootstrap> = bootstrap(),
  stakedCollateralPrice: ethers.BigNumber = bn(1)
) {
  let aggregator: ethers.Contract;

  let oracleNodeId: string;
  const accountId = 1;
  const poolId = 1;

  before('give owner permission to create pools', async () => {
    await r
      .systems()
      .Core.addToFeatureFlagAllowlist(POOL_FEATURE_FLAG, await r.owner().getAddress());
  });

  before('setup oracle manager node', async () => {
    const results = await createOracleNode<Oracle_managerProxy>(
      r.signers()[0],
      stakedCollateralPrice,
      r.systems().OracleManager
    );
    oracleNodeId = results.oracleNodeId;
    aggregator = results.aggregator;
  });

  before('configure collateral', async () => {
    // add collateral
    await (
      await r.systems().Core.connect(r.owner()).configureCollateral({
        tokenAddress: r.systems().CollateralMock.address,
        oracleNodeId,
        issuanceRatioD18: '5000000000000000000',
        liquidationRatioD18: '1500000000000000000',
        liquidationRewardD18: '20000000000000000000',
        minDelegationD18: '20000000000000000000',
        depositingEnabled: true,
      })
    ).wait();
  });

  before('create pool', async () => {
    // create pool
    await r
      .systems()
      .Core.connect(r.owner())
      .createPool(poolId, await r.owner().getAddress());
  });

  before('stake', async function () {
    const [, staker] = r.signers();
    await stake(
      { Core: r.systems().Core, CollateralMock: r.systems().CollateralMock },
      poolId,
      accountId,
      staker
    );
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    aggregator: () => aggregator,
    accountId,
    poolId,
    collateralContract: () => r.systems().CollateralMock,
    collateralAddress: () => r.systems().CollateralMock.address,
    depositAmount,
    restore,
    oracleNodeId: () => oracleNodeId,
  };
}

export function bootstrapWithMockMarketAndPool() {
  const r = bootstrapWithStakedPool();

  let MockMarket: MockMarket;
  let marketId: ethers.BigNumber;

  before('give owner permission to create markets', async () => {
    await r
      .systems()
      .Core.addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, await r.owner().getAddress());
  });

  before('deploy and connect fake market', async () => {
    const [owner, user1] = r.signers();

    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

    // give user1 permission to register market
    await r
      .systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, user1.getAddress());

    marketId = await r.systems().Core.connect(user1).callStatic.registerMarket(MockMarket.address);

    await r.systems().Core.connect(user1).registerMarket(MockMarket.address);

    await MockMarket.connect(owner).initialize(
      r.systems().Core.address,
      marketId,
      ethers.utils.parseEther('1')
    );

    await r
      .systems()
      .Core.connect(owner)
      .setPoolConfiguration(r.poolId, [
        {
          marketId: marketId,
          weightD18: ethers.utils.parseEther('1'),
          maxDebtShareValueD18: ethers.utils.parseEther('1'),
        },
      ]);
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    MockMarket: () => MockMarket,
    marketId: () => marketId,
    restore,
  };
}

export const bn = (n: number) => wei(n).toBN();
