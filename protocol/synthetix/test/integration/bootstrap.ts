import { coreBootstrap } from '@synthetixio/hardhat-router/utils/tests';
import NodeTypes from '@synthetixio/oracle-manager/test/integration/mixins/Node.types';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { MockMarket } from '../../typechain-types/contracts/mocks/MockMarket';
import { snapshotCheckpoint } from '../utils/snapshot';

import type {
  AccountProxy,
  CoreProxy,
  USDProxy,
  CollateralMock,
  Oracle_managerProxy,
} from '../generated/typechain';

const POOL_FEATURE_FLAG = ethers.utils.formatBytes32String('createPool');
const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

interface Proxies {
  AccountProxy: AccountProxy;
  CoreProxy: CoreProxy;
  USDProxy: USDProxy;
  CollateralMock: CollateralMock;
  ['oracle_manager.Proxy']: Oracle_managerProxy;
}

interface Systems {
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

export function bootstrap() {
  before(restoreSnapshot);

  before('give owner permission to create pools and markets', async () => {
    const [owner] = getSigners();
    await systems.Core.addToFeatureFlagAllowlist(POOL_FEATURE_FLAG, await owner.getAddress());
    await systems.Core.addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, await owner.getAddress());
  });

  return {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getSigners()[0],
    systems: () => systems,
  };
}

export function bootstrapWithStakedPool() {
  const r = bootstrap();

  let aggregator: ethers.Contract;

  let oracleNodeId: string;
  const accountId = 1;
  const poolId = 1;
  let collateralAddress: string;
  const depositAmount = ethers.utils.parseEther('1000');
  const abi = ethers.utils.defaultAbiCoder;

  before('deploy mock aggregator', async () => {
    const [owner] = r.signers();

    const factory = await hre.ethers.getContractFactory('AggregatorV3Mock');
    aggregator = await factory.connect(owner).deploy();

    await aggregator.mockSetCurrentPrice(ethers.utils.parseEther('1'));
  });

  before('setup oracle manager node', async () => {
    const [owner] = r.signers();

    const params1 = abi.encode(['address', 'uint256', 'uint8'], [aggregator.address, 0, 18]);
    await r.systems().OracleManager.connect(owner).registerNode([], NodeTypes.CHAINLINK, params1);
    oracleNodeId = await r
      .systems()
      .OracleManager.connect(owner)
      .getNodeId([], NodeTypes.CHAINLINK, params1);
  });

  before('delegate collateral', async function () {
    const [owner, user1] = r.signers();

    // mint initial collateral
    await r.systems().CollateralMock.mint(await user1.getAddress(), depositAmount.mul(1000));

    // deploy an aggregator
    collateralAddress = r.systems().CollateralMock.address;

    // add collateral,
    await (
      await r.systems().Core.connect(owner).configureCollateral({
        tokenAddress: collateralAddress,
        oracleNodeId,
        issuanceRatioD18: '5000000000000000000',
        liquidationRatioD18: '1500000000000000000',
        liquidationRewardD18: '20000000000000000000',
        minDelegationD18: '20000000000000000000',
        depositingEnabled: true,
      })
    ).wait();

    // create pool
    await r
      .systems()
      .Core.connect(owner)
      .createPool(poolId, await owner.getAddress());

    // create user account
    await r.systems().Core.connect(user1).createAccount(accountId);

    // approve
    await r
      .systems()
      .CollateralMock.connect(user1)
      .approve(r.systems().Core.address, depositAmount.mul(10));

    // stake collateral
    await r
      .systems()
      .Core.connect(user1)
      .deposit(accountId, collateralAddress, depositAmount.mul(10));

    // invest in the pool
    await r
      .systems()
      .Core.connect(user1)
      .delegateCollateral(
        accountId,
        poolId,
        collateralAddress,
        depositAmount,
        ethers.utils.parseEther('1')
      );
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    aggregator: () => aggregator,
    accountId,
    poolId,
    collateralContract: () => r.systems().CollateralMock,
    collateralAddress: () => collateralAddress,
    depositAmount,
    restore,
  };
}

export function bootstrapWithMockMarketAndPool() {
  const r = bootstrapWithStakedPool();

  let MockMarket: MockMarket;
  let marketId: ethers.BigNumber;

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
