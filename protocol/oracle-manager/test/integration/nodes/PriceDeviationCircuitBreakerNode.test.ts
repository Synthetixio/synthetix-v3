import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bn, bootstrapWithNodes } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import { NodeModule } from '../../generated/typechain';

describe('PriceDeviationCircuitBreakerNode', function () {
  const { getContract, nodeId1, nodeId3, nodeId4, nodeId5 } = bootstrapWithNodes();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: NodeModule;
  let parents: string[] = [];

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    parents = [nodeId1(), nodeId3()];
  });

  describe('register a circuit breaker with 40% tolerance', async () => {
    let node1: string;
    let node2: string;
    before(async () => {
      // 40% Deviation Tolerance
      const deviationTolerance = bn(0.4);
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
    let nodeId: string;
    before(async () => {
      // 50% Deviation Tolerance
      const deviationTolerance = bn(0.5);
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

  describe('register a circuit breaker with primary price 0', async () => {
    let nodeId: string;
    before(async () => {
      // 50% Deviation Tolerance
      // nodeId5 is 0
      const deviationTolerance = bn(0.5);
      const params = abi.encode(['uint256'], [deviationTolerance]);

      await NodeModule.registerNode(NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER, params, [
        nodeId5(),
        nodeId3(),
      ]);
      nodeId = await NodeModule.getNodeId(NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER, params, [
        nodeId5(),
        nodeId3(),
      ]);
    });

    it('expect process to return first node price since prices are 50% different', async () => {
      await assertRevert(NodeModule.process(nodeId), 'InvalidInputPrice', NodeModule);
    });
  });

  describe('register a circuit breaker with 60% tolerance', async () => {
    let nodeId: string;
    before(async () => {
      // 60% Deviation Tolerance
      const deviationTolerance = bn(0.6);
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

  describe('register a circuit breaker with an unprocessable parent', async () => {
    it('should revert', async () => {
      const params = abi.encode(['uint256'], [bn(0.4)]);
      const parents = [
        '0x626164706172656e740000000000000000000000000000000000000000000000',
        '0x626164706172656e740000000000000000000000000000000000000000000000',
      ];
      await assertRevert(
        NodeModule.registerNode(NodeTypes.PRICE_DEVIATION_CIRCUIT_BREAKER, params, parents),
        'NodeNotRegistered',
        NodeModule
      );
    });
  });
});
