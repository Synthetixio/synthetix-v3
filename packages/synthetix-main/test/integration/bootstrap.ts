import hre from 'hardhat';

import { ethers } from 'ethers';

import fs from 'fs/promises';

async function loadSystems(provider: ethers.providers.Provider) {
  // todo typechain
  const systems: { [name: string]: ethers.Contract } = {};

  const basepath = hre.config.paths.root + '/deployments/hardhat';

  for (const file of await fs.readdir(basepath)) {
    const m = file.match(/^(.*)Proxy.json$/);
    if (m) {
      const info = JSON.parse(
        (await fs.readFile(basepath + '/' + file)).toString('utf-8')
      );
      systems[m[1]] = new ethers.Contract(info.address, info.abi, provider);
    }
  }

  return systems;
}

export function bootstrap() {
  let provider: ethers.providers.JsonRpcProvider;
  let signers: ethers.Signer[];

  let systems: { [key: string]: ethers.Contract };

  before(async () => {
    await hre.run('cannon:build');

    provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

    signers = [];

    for (const s of await hre.ethers.getSigners()) {
      await provider.send('hardhat_impersonateAccount', [s.address]);
      await provider.send('hardhat_setBalance', [
        s.address,
        '10000000000000000000000',
      ]);
      signers.push(await provider.getSigner(s.address));
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
