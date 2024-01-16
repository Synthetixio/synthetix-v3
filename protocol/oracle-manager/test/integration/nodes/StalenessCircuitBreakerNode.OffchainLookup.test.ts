import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import { generateExternalNode } from '../../common/oracleNode';

describe('StalenessCircuitBreakerNode: Offchain Lookup orchestration', function () {
  const { getContract, getProvider } = bootstrap();
  let staleNodeId: string;
  let freshNodeId: string;
  let revertNodeId: string;

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;

  const stalenessTolerance = 50,
    fakePriceId = ethers.utils.formatBytes32String('fakepriceid');

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');

    const currentTimestamp = (await getProvider().getBlock('latest')).timestamp;
    staleNodeId = await generateExternalNode(NodeModule, 100, currentTimestamp - 100);
    freshNodeId = await generateExternalNode(NodeModule, 200, currentTimestamp - 10);

    const lookupParams = abi.encode(
      ['address', 'bytes32', 'uint256'],
      [NodeModule.address, fakePriceId, stalenessTolerance]
    );
    revertNodeId = await NodeModule.callStatic.registerNode(
      NodeTypes.PYTH_OFFCHAIN_LOOKUP,
      lookupParams,
      []
    );

    await NodeModule.registerNode(NodeTypes.PYTH_OFFCHAIN_LOOKUP, lookupParams, []);
  });

  it('provides the output of the first parent if fresh', async () => {
    // Register staleness circuit breaker node with fresh parent
    const NodeParameters = abi.encode(['uint'], [stalenessTolerance]);
    await NodeModule.registerNode(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      freshNodeId,
      revertNodeId,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      freshNodeId,
      revertNodeId,
    ]);

    // Verify that the staleness circuit breaker node outputs the parent's values
    const parentOutput = await NodeModule.process(freshNodeId);
    const nodeOutput = await NodeModule.process(nodeId);
    assertBn.equal(parentOutput.price, nodeOutput.price);
    assertBn.equal(parentOutput.timestamp, nodeOutput.timestamp);
  });

  it('reverts using revertNode from second parent if stale', async () => {
    // Register staleness circuit breaker node with stale parent and a fallback node
    const NodeParameters = abi.encode(['uint'], [stalenessTolerance]);
    await NodeModule.registerNode(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      staleNodeId,
      revertNodeId,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.STALENESS_CIRCUIT_BREAKER, NodeParameters, [
      staleNodeId,
      revertNodeId,
    ]);
    await assertRevert(NodeModule.process(nodeId), 'OracleDataRequired', NodeModule);
  });
});
