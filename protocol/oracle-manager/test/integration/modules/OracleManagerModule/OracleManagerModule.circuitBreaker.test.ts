import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../../bootstrap';
import NodeTypes from '../../mixins/Node.types';

describe('PriceDeviationCircuitBreaker', function () {
  const { getContract, nodeId1, nodeId3, nodeId4 } = bootstrapWithNodes();

  const abi = ethers.utils.defaultAbiCoder;
  let OracleManagerModule: ethers.Contract;
  let parents: string[] = [];

  before('prepare environment', async () => {
    OracleManagerModule = getContract('OracleManagerModule');
    //price = [1, 0.5]
    parents = [nodeId1(), nodeId3()];
  });

  describe('register a circuit breaker with 40% tolerance', async () => {
    let node1, node2;
    before(async () => {
      // 40% Deviation Tolerance
      const deviationTolerance = 40;
      const params = abi.encode(['uint256'], [deviationTolerance]);

      await OracleManagerModule.registerNode(
        parents,
        NodeTypes.PriceDeviationCircuitBreaker,
        params
      );
      node1 = await OracleManagerModule.getNodeId(
        parents,
        NodeTypes.PriceDeviationCircuitBreaker,
        params
      );

      await OracleManagerModule.registerNode(
        [nodeId1(), nodeId4()],
        NodeTypes.PriceDeviationCircuitBreaker,
        params
      );
      node2 = await OracleManagerModule.getNodeId(
        [nodeId1(), nodeId4()],
        NodeTypes.PriceDeviationCircuitBreaker,
        params
      );
    });

    it('expect process to revert for prices = [1, 0.5]', async () => {
      await assertRevert(
        OracleManagerModule.process(node1),
        'DeviationToleranceExceeded',
        OracleManagerModule
      );
    });

    it('expect process to revert for prices = [1, 1.5]', async () => {
      await assertRevert(
        OracleManagerModule.process(node2),
        'DeviationToleranceExceeded',
        OracleManagerModule
      );
    });
  });

  describe('register a circuit breaker with 50% tolerance', async () => {
    let nodeId;
    before(async () => {
      // 50% Deviation Tolerance
      const deviationTolerance = 50;
      const params = abi.encode(['uint256'], [deviationTolerance]);

      await OracleManagerModule.registerNode(
        parents,
        NodeTypes.PriceDeviationCircuitBreaker,
        params
      );
      nodeId = await OracleManagerModule.getNodeId(
        parents,
        NodeTypes.PriceDeviationCircuitBreaker,
        params
      );
    });

    it('expect process to return first node price since prices are 50% different', async () => {
      const priceData = await OracleManagerModule.process(nodeId);
      assertBn.equal(priceData.price, ethers.utils.parseEther('1'));
    });
  });

  describe('register a circuit breaker with 60% tolerance', async () => {
    let nodeId;
    before(async () => {
      // 60% Deviation Tolerance
      const deviationTolerance = 60;
      const params = abi.encode(['uint256'], [deviationTolerance]);

      await OracleManagerModule.registerNode(
        parents,
        NodeTypes.PriceDeviationCircuitBreaker,
        params
      );
      nodeId = await OracleManagerModule.getNodeId(
        parents,
        NodeTypes.PriceDeviationCircuitBreaker,
        params
      );
    });

    it('expect process to return first node price since prices are 50% different', async () => {
      const priceData = await OracleManagerModule.process(nodeId);
      assertBn.equal(priceData.price, ethers.utils.parseEther('1'));
    });
  });
});
