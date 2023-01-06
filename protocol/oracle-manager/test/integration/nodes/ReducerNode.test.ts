import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import NodeOperations from '../mixins/Node.operations';

describe('ReducerNode', function () {
  const { getContract, nodeId1, nodeId2, nodeId3 } = bootstrapWithNodes();

  const abi = ethers.utils.defaultAbiCoder;
  let parents: string[];
  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    parents = [nodeId1(), nodeId2(), nodeId3()];
  });

  // TODO: Use external nodes and demonstrate that these all process correctly.
  it('register a max reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MAX]);

    await NodeModule.registerNode(NodeTypes.REDUCER, params, parents);

    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, params, parents);

    const priceData = await NodeModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('1'));
  });

  it('register a min reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MIN]);

    await NodeModule.registerNode(NodeTypes.REDUCER, params, parents);

    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, params, parents);

    const priceData = await NodeModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.5'));
  });

  it('register a mean reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MEAN]);

    await NodeModule.registerNode(NodeTypes.REDUCER, params, parents);

    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, params, parents);

    const priceData = await NodeModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.8'));
  });

  it('register a median reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MEDIAN]);

    await NodeModule.registerNode(NodeTypes.REDUCER, params, parents);

    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, params, parents);

    const priceData = await NodeModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('register a recent reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.RECENT]);

    await NodeModule.registerNode(NodeTypes.REDUCER, params, parents);

    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, params, parents);

    const priceData = await NodeModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('register a division reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.DIV]);

    await NodeModule.registerNode(NodeTypes.REDUCER, params, parents);

    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, params, parents);

    const priceData = await NodeModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('register a multiply reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MUL]);

    await NodeModule.registerNode(NodeTypes.REDUCER, params, parents);

    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, params, parents);

    const priceData = await NodeModule.process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });
});
