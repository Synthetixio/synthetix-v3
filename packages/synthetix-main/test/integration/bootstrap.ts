import fs from 'fs/promises';
import hre from 'hardhat';
import { ethers } from 'ethers';

import { snapshotCheckpoint } from '../utils';

async function loadSystems(provider: ethers.providers.Provider) {
  // todo typechain
  const systems: { [name: string]: ethers.Contract } = {};

  const basepath = hre.config.paths.root + '/deployments/hardhat';

  for (const file of await fs.readdir(basepath)) {
    const m = file.match(/^(.*)Proxy.json$/);
    if (m) {
      const info = JSON.parse((await fs.readFile(basepath + '/' + file)).toString('utf-8'));
      systems[m[1]] = new ethers.Contract(info.address, info.abi, provider);
    }
  }

  return systems;
}

let _provider: ethers.providers.JsonRpcProvider;

export function bootstrap() {
  let signers: ethers.Signer[];

  let systems: { [key: string]: ethers.Contract };

  before(async function () {
    // allow extra time to build the cannon deployment if required
    this.timeout(300000);

    await hre.run('cannon:build');

    if (!_provider) {
      _provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    }

    signers = [];

    const rawSigners = [
      ...(await hre.ethers.getSigners()),
      new hre.ethers.Wallet(
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        _provider
      ),
      new hre.ethers.Wallet(
        '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
        _provider
      ),
      new hre.ethers.Wallet(
        '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
        _provider
      ),
      new hre.ethers.Wallet(
        '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
        _provider
      ),
    ];

    // Complete given signers with default hardhat wallets, to make sure
    // that we always have default accounts to test stuff
    for (const rawSigner of rawSigners) {
      const signer = await _provider.getSigner(await rawSigner.getAddress());

      await _provider.send('hardhat_impersonateAccount', [await signer.getAddress()]);
      await _provider.send('hardhat_setBalance', [
        await signer.getAddress(),
        '10000000000000000000000',
      ]);

      signers.push(signer);
    }

    systems = await loadSystems(_provider);
  });

  return {
    provider: () => _provider,
    signers: () => signers,
    owner: () => signers[0],
    systems: () => systems,
  };
}

export function bootstrapWithStakedPool() {
  const r = bootstrap();

  let aggregator: ethers.Contract;

  const accountId = 1;
  const poolId = 1;
  let collateralAddress: string;
  const depositAmount = ethers.utils.parseEther('1000');

  before('deploy mock aggregator', async () => {
    const [owner] = r.signers();
    const factory = await hre.ethers.getContractFactory('AggregatorV3Mock');
    aggregator = await factory.connect(owner).deploy();

    await aggregator.mockSetCurrentPrice(ethers.utils.parseEther('1'));
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
    await r
      .systems()
      .Core.connect(owner)
      .configureCollateralType(
        collateralAddress,
        aggregator.address,
        '5000000000000000000',
        '1500000000000000000',
        '20000000000000000000',
        true
      );

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
      .depositCollateral(accountId, collateralAddress, depositAmount.mul(10));

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

  let MockMarket: ethers.Contract;
  let marketId: ethers.BigNumber;

  before('deploy and connect fake market', async () => {
    const [owner, user1] = r.signers();

    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

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
      .setPoolPosition(
        r.poolId,
        [marketId],
        [ethers.utils.parseEther('1')],
        [ethers.utils.parseEther('1')]
      );
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    MockMarket: () => MockMarket,
    marketId: () => marketId,
    restore,
  };
}
