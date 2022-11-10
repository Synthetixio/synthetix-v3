import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../../bootstrap';
import NodeTypes from '../../mixins/Node.types';
import NodeOperations from '../../mixins/Node.operations';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

describe('OracleManagerModule', function () {
  const { signers, systems, nodeId1, nodeId2, abi } = bootstrapWithNodes();

  let owner: ethers.Signer;

  before('identify signers', async () => {
    [owner] = signers();
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

  it('reverts on register a node with an invalid parent', async () => {
    const invalidNode = abi.encode(['int'], [0]);

    await assertRevert(
      systems()
        .Core.connect(owner)
        .registerNode([invalidNode], NodeTypes.REDUCER, abi.encode(['int'], [NodeOperations.MAX])),
      `NodeNotRegistered("${invalidNode}")`,
      systems().Core
    );
  });

  it('emits an event on registering a new node', async () => {
    const params = abi.encode(['int'], [NodeOperations.MAX]);

    const tx = await systems().Core.connect(owner).registerNode([], NodeTypes.REDUCER, params);
    const receipt = await tx.wait();

    const event = findSingleEvent({
      receipt,
      eventName: 'NodeRegistered',
    });
    const nodeId = await systems().Core.connect(owner).getNodeId([], NodeTypes.REDUCER, params);

    assert.equal(event.args.nodeId, nodeId);
    assert.equal(event.args.nodeType, NodeTypes.REDUCER);
    assert.equal(event.args.parameters, params);
  });
});
