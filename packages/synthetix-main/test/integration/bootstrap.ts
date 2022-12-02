import hre from 'hardhat';
import { ChainBuilderContext } from '@usecannon/builder';
import { ethers } from 'ethers';
import { glob, runTypeChain } from 'typechain';

import { AccountProxy, CoreProxy, SNXProxy, USDProxy } from '../generated/typechain';
import { snapshotCheckpoint } from '../utils/snapshot';

import NodeTypes from '@synthetixio/oracle-manager/test/integration/mixins/Node.types';

import { MockMarket } from '../../typechain-types/contracts/mocks/MockMarket';

const POOL_FEATURE_FLAG = ethers.utils.formatBytes32String('createPool');
const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

async function loadSystems(
  contracts: ChainBuilderContext['contracts'],
  provider: ethers.providers.Provider
) {
  // todo typechain
  const systems: { [name: string]: ethers.Contract } = {};

  const proxies = Object.keys(contracts).filter((name) => name.endsWith('Proxy'));

  for (const proxyName of proxies) {
    const { address, abi } = contracts[proxyName];
    const name = proxyName.slice(0, -5); // remove "Proxy" from the end
    systems[name] = new ethers.Contract(address, abi, provider);
  }

  return systems;
}

let provider: ethers.providers.JsonRpcProvider;

let signers: ethers.Signer[];

let systems: {
  Account: AccountProxy;
  Core: CoreProxy;
  USD: USDProxy;
  SNX: SNXProxy;
  OracleManager: any;
};

let baseSystemSnapshot: unknown;

before(async function () {
  // allow extra time to build the cannon deployment if required
  this.timeout(300000);

  const cmd = hre.network.name === 'cannon' ? 'build' : 'deploy';

  const cannonInfo = await hre.run(`cannon:${cmd}`, {
    cannonfile: 'cannonfile.test.toml', // build option to override cannonfile
    overrideManifest: 'cannonfile.test.toml', // deploy option to override cannonfile
    writeDeployments: cmd === 'deploy' ? true : 'test/generated/deployments', // deploy the cannon deployments
  });

  let outDir = ['test/generated/deployments/*.json'];

  // hack beacuse cannon does not support specifying write directory for deployment
  if (cmd === 'deploy') {
    outDir = ['deployments/*.json'];
  }

  const allFiles = glob(hre.config.paths.root, outDir);

  await runTypeChain({
    cwd: hre.config.paths.root,
    filesToProcess: allFiles,
    allFiles,
    target: 'ethers-v5',
    outDir: 'test/generated/typechain',
  });

  provider = cannonInfo.provider;
  signers = cannonInfo.signers;

  try {
    await provider.send('anvil_setBlockTimestampInterval', [1]);
  } catch (err) {
    console.warn('failed when setting block timestamp interval', err);
  }

  baseSystemSnapshot = await provider.send('evm_snapshot', []);
  const { outputs } = cannonInfo;

  // load local and imported contracts
  const contracts = {
    ...(outputs.contracts ?? {}),
    ...(outputs.imports?.synthetix?.contracts ?? {}),
    OracleManagerProxy: outputs.imports?.oracle_manager?.contracts.Proxy,
  };

  // after a lot of testing, we *really* need the any here in order to accomplish the typing we need
  systems = (await loadSystems(contracts, provider)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  console.log('completed initial bootstrap');
});

export function bootstrap() {
  before(async () => {
    await provider.send('evm_revert', [baseSystemSnapshot]);
    baseSystemSnapshot = await provider.send('evm_snapshot', []);
  });

  before('give owner permission to create pools and markets', async () => {
    const owner = signers[0];
    await systems.Core.connect(owner).addToFeatureFlagAllowlist(
      POOL_FEATURE_FLAG,
      await owner.getAddress()
    );
    await systems.Core.connect(owner).addToFeatureFlagAllowlist(
      MARKET_FEATURE_FLAG,
      await owner.getAddress()
    );
  });

  return {
    provider: () => provider,
    signers: () => signers,
    owner: () => signers[0],
    systems: () => systems,
  };
}

export function bootstrapWithStakedPool() {
  const r = bootstrap();

  let aggregator: ethers.Contract;

  let nodeId: string;
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

    const params1 = abi.encode(['address'], [aggregator.address]);
    await r.systems().OracleManager.connect(owner).registerNode([], NodeTypes.CHAINLINK, params1);
    nodeId = await r
      .systems()
      .OracleManager.connect(owner)
      .getNodeId([], NodeTypes.CHAINLINK, params1);
  });

  before('delegate collateral', async function () {
    const [owner, user1] = r.signers();

    // mint initial snx
    await r
      .systems()
      .Core.connect(owner)
      .mintInitialSystemToken(await user1.getAddress(), depositAmount.mul(1000));

    // deploy an aggregator
    collateralAddress = r.systems().SNX.address;

    // add snx as collateral,
    await (
      await r.systems().Core.connect(owner).configureCollateral({
        tokenAddress: collateralAddress,
        oracleNodeId: nodeId,
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
    await r.systems().SNX.connect(user1).approve(r.systems().Core.address, depositAmount.mul(10));

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
    collateralContract: () => r.systems().SNX,
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
