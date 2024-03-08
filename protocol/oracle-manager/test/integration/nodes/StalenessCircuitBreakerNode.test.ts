import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { BigNumberish, ethers, Signer } from 'ethers';

import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import hre from 'hardhat';

describe('StalenessCircuitBreakerNode', function () {
  const { getContract, getSigners, getProvider } = bootstrap();
  let owner: Signer;
  let staleNodeId: string;
  let freshNodeId: string;
  let fallbackNodeId: string;
  let zeroPriceNodeId: string;

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;

  const stalenessTolerance = 50;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    owner = getSigners()[0];

    const currentTimestamp = (await getProvider().getBlock('latest')).timestamp;
    staleNodeId = await deployAndRegisterExternalNode(100, currentTimestamp - 100);
    freshNodeId = await deployAndRegisterExternalNode(200, currentTimestamp - 10);
    fallbackNodeId = await deployAndRegisterExternalNode(300, currentTimestamp);
    zeroPriceNodeId = await deployAndRegisterExternalNode(0, currentTimestamp);
  });

  it('provides the output of the first parent if fresh', async () => {
    // Register staleness circuit breaker node with fresh parent
    const NodeParameters = abi.encode(['uint'], [stalenessTolerance]);
    await NodeModule.registerNode(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      freshNodeId,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      freshNodeId,
    ]);

    // Verify that the staleness circuit breaker node outputs the parent's values
    const parentOutput = await NodeModule.process(freshNodeId);
    const nodeOutput = await NodeModule.process(nodeId);
    assertBn.equal(parentOutput.price, nodeOutput.price);
    assertBn.equal(parentOutput.timestamp, nodeOutput.timestamp);
  });

  it('provides the output of the second parent if stale', async () => {
    // Register staleness circuit breaker node with stale parent and a fallback node
    const NodeParameters = abi.encode(['uint'], [stalenessTolerance]);
    await NodeModule.registerNode(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      staleNodeId,
      fallbackNodeId,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      staleNodeId,
      fallbackNodeId,
    ]);

    // Verify that the staleness circuit breaker node outputs the fallback's values
    const fallbackOutput = await NodeModule.process(fallbackNodeId);
    const nodeOutput = await NodeModule.process(nodeId);
    assertBn.equal(fallbackOutput.price, nodeOutput.price);
    assertBn.equal(fallbackOutput.timestamp, nodeOutput.timestamp);
  });

  it('return 0 if second parent output is 0 and first parent output is stale', async () => {
    const NodeParameters = abi.encode(['uint'], [stalenessTolerance]);
    await NodeModule.registerNode(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      staleNodeId,
      zeroPriceNodeId,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      staleNodeId,
      zeroPriceNodeId,
    ]);

    const zeroPriceOutput = await NodeModule.process(zeroPriceNodeId);
    const nodeOutput = await NodeModule.process(nodeId);
    assertBn.equal(0, nodeOutput.price);
    assertBn.equal(zeroPriceOutput.timestamp, nodeOutput.timestamp);
  });

  it('throws if stale and no second parent', async () => {
    // Register staleness circuit breaker node with stale parent
    const NodeParameters = abi.encode(['uint'], [stalenessTolerance]);
    await NodeModule.registerNode(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      staleNodeId,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      staleNodeId,
    ]);

    // Verify that the staleness circuit breaker node throws
    await assertRevert(NodeModule.process(nodeId), 'StalenessToleranceExceeded()', NodeModule);
  });

  async function deployAndRegisterExternalNode(price: BigNumberish, timestamp: BigNumberish) {
    // Deploy the mock
    const factory = await hre.ethers.getContractFactory('MockExternalNode');
    const externalNode = await factory.connect(owner).deploy(price, timestamp);

    // Register the external node referencing the mock
    const NodeParameters = abi.encode(['address'], [externalNode.address]);
    await NodeModule.registerNode(NodeTypes.EXTERNAL, NodeParameters, []);

    // Return the ID
    return await NodeModule.getNodeId(NodeTypes.EXTERNAL, NodeParameters, []);
  }

  describe('register a circuit breaker with an unprocessable parent', async () => {
    it('should revert', async () => {
      const params = abi.encode(['uint'], [50]);
      const parents = [
        '0x626164706172656e740000000000000000000000000000000000000000000000',
        '0x626164706172656e740000000000000000000000000000000000000000000000',
      ];
      await assertRevert(
        NodeModule.registerNode(NodeTypes.STALENESS_CIRCUIT_BREAKER, params, parents),
        'NodeNotRegistered',
        NodeModule
      );
    });
  });
});
