import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import NodeOperations from '../mixins/Node.operations';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

const abi = ethers.utils.defaultAbiCoder;

describe('NodeModule', function () {
  const { getContract, nodeId1, nodeId2 } = bootstrapWithNodes();

  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
  });

  it('make sure mock aggregator node is set up', async () => {
    const node = await NodeModule.getNode(nodeId1());
    assert.notEqual(node.nodeType, NodeTypes.NONE);
  });

  it('Test price on leaf nodes', async () => {
    let priceData = await NodeModule.process(nodeId1());
    assertBn.equal(priceData.price, ethers.utils.parseEther('1'));

    priceData = await NodeModule.process(nodeId2());
    assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
  });

  it('reverts on register a node with an invalid parent', async () => {
    const invalidNode = abi.encode(['int'], [0]);

    await assertRevert(
      NodeModule.registerNode(NodeTypes.REDUCER, abi.encode(['int'], [NodeOperations.MAX]), [
        invalidNode,
      ]),
      'InvalidNodeDefinition',
      NodeModule
    );
  });

  it('emits an event on registering a new node', async () => {
    const params = abi.encode(['int'], [NodeOperations.MAX]);

    const tx = await NodeModule.registerNode(NodeTypes.REDUCER, params, [nodeId1(), nodeId2()]);
    const receipt = await tx.wait();

    const event = findSingleEvent({
      receipt,
      eventName: 'NodeRegistered',
    });
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, params, [nodeId1(), nodeId2()]);

    assert.equal(event.args.nodeId, nodeId);
    assert.equal(event.args.nodeType, NodeTypes.REDUCER);
    assert.equal(event.args.parameters, params);
  });
});
