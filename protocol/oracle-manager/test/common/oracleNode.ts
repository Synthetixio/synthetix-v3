import { ethers } from 'ethers';
import hre from 'hardhat';
import { Proxy } from '../generated/typechain';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';
import NodeTypes from '../integration/mixins/Node.types';

/* utility function to use for other bootstrappers wanting to add a new oracle node */
export const createOracleNode = async (
  owner: ethers.Signer,
  price: ethers.BigNumber,
  OracleManager: Proxy
) => {
  const abi = ethers.utils.defaultAbiCoder;
  const factory = await hre.ethers.getContractFactory('AggregatorV3Mock');
  const aggregator = await factory.connect(owner).deploy();

  await aggregator.mockSetCurrentPrice(price);

  const params1 = abi.encode(['address', 'uint256', 'uint8'], [aggregator.address, 0, 18]);
  await OracleManager.connect(owner).registerNode(NodeTypes.CHAINLINK, params1, []);
  const oracleNodeId = await OracleManager.connect(owner).getNodeId(
    NodeTypes.CHAINLINK,
    params1,
    []
  );

  return {
    oracleNodeId,
    aggregator,
  };
};

// Note: must have deployed `MockExternalNode`
export const generateExternalNode = async (OracleManager: Proxy, price: number) => {
  const factory = await hre.ethers.getContractFactory('MockExternalNode');
  const externalNode = await factory.deploy(price, 200); // used to have .connect(owner)

  // Register the mock
  const NodeParameters = ethers.utils.defaultAbiCoder.encode(['address'], [externalNode.address]);
  const tx = await OracleManager.registerNode(NodeTypes.EXTERNAL, NodeParameters, []);
  const receipt = await tx.wait();
  const event = findSingleEvent({
    receipt,
    eventName: 'NodeRegistered',
  });
  return event.args.nodeId;
};
