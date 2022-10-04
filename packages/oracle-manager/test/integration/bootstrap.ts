import hre from 'hardhat';
import { ChainBuilderContext } from '@usecannon/builder';
import { ethers } from 'ethers';

import { snapshotCheckpoint } from '../utils';
import NodeTypes from './mixins/Node.types';

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
  let aggregator2: ethers.Contract;

  let nodeId1: string;
  let nodeId2: string;
  let collateralAddress: string;
  const depositAmount = ethers.utils.parseEther('1000');
  const abi = ethers.utils.defaultAbiCoder;

  before('deploy mock aggregator', async () => {
    const [owner] = r.signers();
    const factory = await hre.ethers.getContractFactory('AggregatorV3Mock');
    aggregator = await factory.connect(owner).deploy();

    await aggregator.mockSetCurrentPrice(ethers.utils.parseEther('1'));

    aggregator2 = await factory.connect(owner).deploy();
    await aggregator2.mockSetCurrentPrice(ethers.utils.parseEther('0.9'));
  });

  before('register leaf nodes', async function () {
    const [owner] = r.signers();
    const params1 = abi.encode(['address'], [aggregator.address]);
    const params2 = abi.encode(['address'], [aggregator2.address]);

    // register node 1
    await r.systems().Core.connect(owner).registerNode([], NodeTypes.CHAINLINK, params1);
    nodeId1 = await r.systems().Core.connect(owner).getNodeId([], NodeTypes.CHAINLINK, params1);

    // register node 2
    await r.systems().Core.connect(owner).registerNode([], NodeTypes.CHAINLINK, params2);
    nodeId2 = await r.systems().Core.connect(owner).getNodeId([], NodeTypes.CHAINLINK, params2);
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    aggregator: () => aggregator,
    nodeId1: () => nodeId1,
    nodeId2: () => nodeId2,
    collateralContract: () => r.systems().SNX,
    collateralAddress: () => collateralAddress,
    depositAmount,
    abi,
    restore,
  };
}
