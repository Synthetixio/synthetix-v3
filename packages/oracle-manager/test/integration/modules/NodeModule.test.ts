import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import NodeOperations from '../mixins/Node.operations';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('NodeModule', function () {
  const { signers, systems, nodeId1, nodeId2, nodeId3, abi } = bootstrapWithNodes();

  let owner: ethers.Signer;
  let parents: string[];

  before('identify signers', async () => {
    [owner] = signers();
    parents = [nodeId1(), nodeId2(), nodeId3()];
  });

  it('make sure mock aggregator node is set up', async () => {
    const node = await systems().Core.connect(owner).getNode(nodeId1());
    assert.notEqual(node.nodeType, NodeTypes.NONE);
  });

  it('Test price on leaf nodes', async () => {
    let priceData = await systems().Core.connect(owner).process(nodeId1());
    console.log('priceData:', priceData);
    assertBn.equal(priceData.price, ethers.utils.parseEther('1'));

    priceData = await systems().Core.connect(owner).process(nodeId2());
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('register a max reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MAX]);

    await systems().Core.connect(owner).registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await systems()
      .Core.connect(owner)
      .getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await systems().Core.connect(owner).process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('1'));
  });

  it('register a min reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MIN]);

    await systems().Core.connect(owner).registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await systems()
      .Core.connect(owner)
      .getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await systems().Core.connect(owner).process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.5'));
  });

  it('register a mean reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MEAN]);

    await systems().Core.connect(owner).registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await systems()
      .Core.connect(owner)
      .getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await systems().Core.connect(owner).process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.8'));
  });

  it('register a median reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MEDIAN]);

    await systems().Core.connect(owner).registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await systems()
      .Core.connect(owner)
      .getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await systems().Core.connect(owner).process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('register a recent reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.RECENT]);

    await systems().Core.connect(owner).registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await systems()
      .Core.connect(owner)
      .getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await systems().Core.connect(owner).process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('reverts on register a node with invalid parent', async () => {
    const invalidNode = abi.encode(['int'], [0]);

    await assertRevert(
      systems()
        .Core.connect(owner)
        .registerNode([invalidNode], NodeTypes.REDUCER, abi.encode(['int'], [NodeOperations.MAX])),
      `NodeNotRegistered("${invalidNode}")`,
      systems().Core
    );
  });
});
