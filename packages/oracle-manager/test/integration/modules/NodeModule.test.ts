import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import NodeOperations from '../mixins/Node.operations';

describe('NodeModule', function () {
  const { signers, systems, nodeId1, nodeId2, abi } = bootstrapWithNodes();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  it('make sure mock aggregator node is set up', async () => {
    const node = await systems().Core.connect(owner).getNode(nodeId1());
    assert.notEqual(node.nodeType, NodeTypes.NONE);
  });

  it('Test price on leaf nodes', async () => {
    let priceData = await systems().Core.connect(owner).process(nodeId1());
    assertBn.equal(priceData.price, ethers.utils.parseEther('1'));

    priceData = await systems().Core.connect(owner).process(nodeId2());
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('register a max reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MAX]);
    const parents = [nodeId1(), nodeId2()];

    await systems().Core.connect(owner).registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await systems()
      .Core.connect(owner)
      .getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await systems().Core.connect(owner).process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('1'));
  });

  it('register a min reducer', async () => {
    const params = abi.encode(['int'], [NodeOperations.MIN]);
    const parents = [nodeId1(), nodeId2()];

    await systems().Core.connect(owner).registerNode(parents, NodeTypes.REDUCER, params);

    const nodeId = await systems()
      .Core.connect(owner)
      .getNodeId(parents, NodeTypes.REDUCER, params);

    const priceData = await systems().Core.connect(owner).process(nodeId);
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });
});
