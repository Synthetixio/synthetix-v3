import hre from 'hardhat';

import { ethers, providers } from 'ethers';

import fs from 'fs/promises';
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

export function bootstrap() {
  let provider: ethers.providers.JsonRpcProvider;
  let signers: ethers.Signer[];

  let systems: { [key: string]: ethers.Contract };

  before(async function () {
    // allow extra time to build the cannon deployment if required
    this.timeout(300000);

    const rawSigs = [...(await hre.ethers.getSigners())];

    await hre.run('cannon:build');

    provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

    signers = [];

    for (const s of rawSigs) {
      await provider.send('hardhat_impersonateAccount', [await s.getAddress()]);
      await provider.send('hardhat_setBalance', [await s.getAddress(), '10000000000000000000000']);
      signers.push(await provider.getSigner(await s.getAddress()));
    }

    systems = await loadSystems(provider);
  });

  return {
    provider: () => provider,
    signers: () => signers,
    owner: () => signers[0],
    systems: () => systems,
  };
}

export function bootstrapWithStakedFund() {
  const r = bootstrap();

  let aggregator: ethers.Contract;

  const accountId = 1;
  const fundId = 1;
  let collateralAddress: string;
  const depositAmount = ethers.utils.parseEther('1000');

  let snapshotId: any;

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
      .mintInitialSystemToken(await user1.getAddress(), depositAmount.mul(10));

    // deploy an aggregator
    collateralAddress = r.systems().SNX.address;

    // add snx as collateral,
    await r
      .systems()
      .Core.connect(owner)
      .adjustCollateralType(
        collateralAddress,
        aggregator.address,
        '5000000000000000000',
        '1500000000000000000',
        true
      );

    // create fund
    await r
      .systems()
      .Core.connect(owner)
      .createFund(fundId, await owner.getAddress());

    // create user account
    await r.systems().Core.connect(user1).createAccount(accountId);

    // approve
    await r.systems().SNX.connect(user1).approve(r.systems().Core.address, depositAmount);

    // stake collateral
    await r.systems().Core.connect(user1).stake(accountId, collateralAddress, depositAmount);

    // invest in the fund
    await r
      .systems()
      .Core.connect(user1)
      .delegateCollateral(
        accountId,
        fundId,
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
    fundId,
    collateralContract: () => r.systems().SNX,
    collateralAddress: () => collateralAddress,
    depositAmount,
    restore,
  };
}
