import { ethers } from 'ethers';
import hre from 'hardhat';
import { Proxy } from '@synthetixio/oracle-manager/test/generated/typechain';
import NodeTypes from '@synthetixio/oracle-manager/test/integration/mixins/Node.types';

export const createKeeperCostNode = async (owner: ethers.Signer, OracleManager: Proxy) => {
  const abi = ethers.utils.defaultAbiCoder;
  const factory = await hre.ethers.getContractFactory('MockGasPriceNode');
  const keeperCostNode = await factory.connect(owner).deploy();

  await keeperCostNode.setCosts(0, 0, 0);

  const params1 = abi.encode(['address'], [keeperCostNode.address]);
  await OracleManager.connect(owner).registerNode(NodeTypes.EXTERNAL, params1, []);
  const keeperCostNodeId = await OracleManager.connect(owner).getNodeId(
    NodeTypes.EXTERNAL,
    params1,
    []
  );

  return {
    keeperCostNodeId,
    keeperCostNode,
  };
};
