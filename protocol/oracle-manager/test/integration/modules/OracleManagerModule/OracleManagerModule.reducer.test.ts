import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../../bootstrap';
import NodeTypes from '../../mixins/Node.types';
import NodeOperations from '../../mixins/Node.operations';

describe('OracleManagerModule', function () {
  const { getContract, nodeId1, nodeId2, nodeId3 } = bootstrapWithNodes();

  const abi = ethers.utils.defaultAbiCoder;
  let parents: string[];
  let OracleManagerModule: ethers.Contract;

  before('prepare environment', async () => {
    OracleManagerModule = getContract('OracleManagerModule');
    parents = [nodeId1(), nodeId2(), nodeId3()];
  });

  it('register a max reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MAX]);

    await OracleManagerModule.registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await OracleManagerModule.getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await OracleManagerModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('1'));
  });

  it('register a min reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MIN]);

    await OracleManagerModule.registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await OracleManagerModule.getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await OracleManagerModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.5'));
  });

  it('register a mean reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MEAN]);

    await OracleManagerModule.registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await OracleManagerModule.getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await OracleManagerModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.8'));
  });

  it('register a median reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MEDIAN]);

    await OracleManagerModule.registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await OracleManagerModule.getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await OracleManagerModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('register a recent reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.RECENT]);

    await OracleManagerModule.registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await OracleManagerModule.getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await OracleManagerModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });
});
