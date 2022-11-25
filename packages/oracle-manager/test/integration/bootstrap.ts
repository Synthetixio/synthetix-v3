import hre from 'hardhat';
import { bootstrap } from '@synthetixio/core-router/util/bootstrap';
import { ethers } from 'ethers';

import { snapshotCheckpoint } from '../utils';
import NodeTypes from './mixins/Node.types';

const abi = ethers.utils.defaultAbiCoder;

export function bootstrapWithNodes() {
  const r = bootstrap();

  let aggregator: ethers.Contract;
  let aggregator2: ethers.Contract;
  let aggregator3: ethers.Contract;

  let nodeId1: string;
  let nodeId2: string;
  let nodeId3: string;

  before('deploy mock aggregator', async () => {
    const [owner] = r.getSigners();
    const factory = await hre.ethers.getContractFactory('AggregatorV3Mock');

    aggregator = await factory.connect(owner).deploy();
    await aggregator.mockSetCurrentPrice(ethers.utils.parseEther('1'));

    aggregator3 = await factory.connect(owner).deploy();
    await aggregator3.mockSetCurrentPrice(ethers.utils.parseEther('0.5'));

    aggregator2 = await factory.connect(owner).deploy();
    await aggregator2.mockSetCurrentPrice(ethers.utils.parseEther('0.9'));
  });

  before('register leaf nodes', async function () {
    const OracleManagerModule = r.getContract('OracleManagerModule');

    const params1 = abi.encode(['address'], [aggregator.address]);
    const params2 = abi.encode(['address'], [aggregator2.address]);
    const params3 = abi.encode(['address'], [aggregator3.address]);

    const registerNode = async (params: string) => {
      const tx = await OracleManagerModule.registerNode([], NodeTypes.CHAINLINK, params);
      await tx.wait();
      return await OracleManagerModule.getNodeId([], NodeTypes.CHAINLINK, params);
    };

    // register node 1
    nodeId1 = await registerNode(params1);
    nodeId2 = await registerNode(params2);
    nodeId3 = await registerNode(params3);
  });

  const restoreSnapshot = snapshotCheckpoint(
    r.getProvider as unknown as () => ethers.providers.JsonRpcProvider
  );

  return {
    ...r,
    restoreSnapshot,
    nodeId1: () => nodeId1,
    nodeId2: () => nodeId2,
    nodeId3: () => nodeId3,
  };
}
