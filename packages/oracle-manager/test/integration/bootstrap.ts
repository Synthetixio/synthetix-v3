import hre from 'hardhat';
import { ChainBuilderContext } from '@usecannon/builder';
import { ethers } from 'ethers';

import { snapshotCheckpoint } from '../utils';

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

let systems: { [key: string]: ethers.Contract };

let baseSystemSnapshot: unknown;

before(async function () {
  // allow extra time to build the cannon deployment if required
  this.timeout(300000);

  const cmd = hre.network.name === 'cannon' ? 'build' : 'deploy';

  const cannonInfo = await hre.run(`cannon:${cmd}`);

  provider = cannonInfo.provider;
  signers = cannonInfo.signers;

  try {
    await provider.send('anvil_setBlockTimestampInterval', [1]);
  } catch (err) {
    console.warn('failed when setting block timestamp interval', err);
  }

  baseSystemSnapshot = await provider.send('evm_snapshot', []);

  systems = await loadSystems(cannonInfo.outputs.contracts, provider);

  console.log('completed initial bootstrap');
});

export function bootstrap() {
  before(async () => {
    await provider.send('evm_revert', [baseSystemSnapshot]);
    baseSystemSnapshot = await provider.send('evm_snapshot', []);
  });

  return {
    provider: () => provider,
    signers: () => signers,
    owner: () => signers[0],
    systems: () => systems,
  };
}

export function bootstrapWithNodes() {
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
