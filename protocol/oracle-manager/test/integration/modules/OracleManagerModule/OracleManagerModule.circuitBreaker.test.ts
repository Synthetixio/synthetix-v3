import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../../bootstrap';
import NodeTypes from '../../mixins/Node.types';

describe('PriceDeviationCircuitBreaker', function () {
  const { getContract, nodeId1, nodeId3 } = bootstrapWithNodes();

  const abi = ethers.utils.defaultAbiCoder;
  let OracleManagerModule: ethers.Contract;
  let parents: string[] = [];

  before('prepare environment', async () => {
    OracleManagerModule = getContract('OracleManagerModule');
    parents = [nodeId1(), nodeId3()];
  });

  describe('register a circuit breaker with 40% tolerance', async () => {
    let nodeId;
    before(async () => {
      // 40% Deviation Tolerance
      const deviationTolerance = 40;
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

    it('expect process to revert since prices are 50% different', async () => {
      await assertRevert(
        OracleManagerModule.process(nodeId),
        'DeviationToleranceExceed',
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
