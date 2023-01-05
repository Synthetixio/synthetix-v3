import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../../bootstrap';
import NodeTypes from '../../mixins/Node.types';

describe('PRICE_DEVIATION_CIRCUIT_BREAKER', function () {
  const { getContract, nodeId1, nodeId3, nodeId4 } = bootstrapWithNodes();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;
  let parents: string[] = [];

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    //price = [1, 0.5]
    parents = [nodeId1(), nodeId3()];
  });

  describe('register a circuit breaker with 40% tolerance', async () => {
    let node1, node2;
    before(async () => {
      // 40% Deviation Tolerance
      const deviationTolerance = 40;
      const params = abi.encode(['uint256'], [deviationTolerance]);

      await NodeModule.registerNode(NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER, params, parents);
      node1 = await NodeModule.getNodeId(
        NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER,
        params,
        parents
      );

      await NodeModule.registerNode(NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER, params, [
        nodeId1(),
        nodeId4(),
      ]);
      node2 = await NodeModule.getNodeId(NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER, params, [
        nodeId1(),
        nodeId4(),
      ]);
    });

    it('expect process to revert for prices = [1, 0.5]', async () => {
      await assertRevert(NodeModule.process(node1), 'DeviationToleranceExceeded', NodeModule);
    });

    it('expect process to revert for prices = [1, 1.5]', async () => {
      await assertRevert(NodeModule.process(node2), 'DeviationToleranceExceeded', NodeModule);
    });
  });

  describe('register a circuit breaker with 50% tolerance', async () => {
    let nodeId;
    before(async () => {
      // 50% Deviation Tolerance
      const deviationTolerance = 50;
      const params = abi.encode(['uint256'], [deviationTolerance]);

      await NodeModule.registerNode(NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER, params, parents);
      nodeId = await NodeModule.getNodeId(
        NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER,
        params,
        parents
      );
    });

    it('expect process to return first node price since prices are 50% different', async () => {
      const priceData = await NodeModule.process(nodeId);
      assertBn.equal(priceData.price, ethers.utils.parseEther('1'));
    });
  });

  describe('register a circuit breaker with 60% tolerance', async () => {
    let nodeId;
    before(async () => {
      // 60% Deviation Tolerance
      const deviationTolerance = 60;
      const params = abi.encode(['uint256'], [deviationTolerance]);

      await NodeModule.registerNode(NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER, params, parents);
      nodeId = await NodeModule.getNodeId(
        NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER,
        params,
        parents
      );
    });

    it('expect process to return first node price since prices are 50% different', async () => {
      const priceData = await NodeModule.process(nodeId);
      assertBn.equal(priceData.price, ethers.utils.parseEther('1'));
    });
  });
});
