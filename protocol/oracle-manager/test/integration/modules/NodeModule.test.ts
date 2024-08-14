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
  const { getContract, nodeId1, aggregator, nodeId2, failingNodeId } = bootstrapWithNodes();

  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
  });

  it('make sure mock aggregator node is set up', async () => {
    const node = await NodeModule.getNode(nodeId1());
    assert.notEqual(node.nodeType, NodeTypes.NONE);
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

  describe('process()', () => {
    it('Test price on leaf nodes', async () => {
      let priceData = await NodeModule.process(nodeId1());
      assertBn.equal(priceData.price, ethers.utils.parseEther('1'));

      priceData = await NodeModule.process(nodeId2());
      assertBn.equal(priceData.price, ethers.utils.parseEther('0.9'));
    });

    it('passes through errors', async () => {
      await assertRevert(
        NodeModule.process(failingNodeId()),
        '0xac47be2100000000000000000000000000000000000000000000000000000000000004d2'
      );
    });
  });

  describe('processManyWithRuntime()', () => {
    it('when everything is success, returns an array with all the good stuff', async () => {
      const priceDatas = await NodeModule.processManyWithRuntime([nodeId2(), nodeId1()], [], []);

      assertBn.equal(priceDatas[0].price, ethers.utils.parseEther('0.9'));
      assertBn.equal(priceDatas[1].price, ethers.utils.parseEther('1.0'));
    });

    it('when fail, returns Errors() event', async () => {
      await assertRevert(
        NodeModule.processManyWithRuntime(
          [failingNodeId(), nodeId2(), nodeId1(), failingNodeId()],
          [],
          []
        ),
        'Errors("0xac47be2100000000000000000000000000000000000000000000000000000000000004d2","0xac47be2100000000000000000000000000000000000000000000000000000000000004d2")',
        NodeModule
      );
    });

    it('when a nested nested node fails, returns correct Errors() event', async () => {
      const NodeParameters = abi.encode(['uint'], [NodeOperations.MEDIAN]);
      await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [nodeId1(), nodeId2()]);
      const reducer1Id = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
        nodeId1(),
        nodeId2(),
      ]);
      await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [reducer1Id, nodeId2()]);
      const reducer2Id = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
        reducer1Id,
        nodeId2(),
      ]);

      // cause an error after the fact on one of the internal nodes
      await aggregator().mockSetFails(82828);

      // should get the errors from the very deep reducer node, wrapped in two `Errors`. It will be parsed recursively outside
      await assertRevert(
        NodeModule.processManyWithRuntime([nodeId2(), nodeId1(), reducer2Id], [], []),
        'Errors("0xac47be2100000000000000000000000000000000000000000000000000000000000004d2,0x0b42fd17000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000001040b42fd1700000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000024ac47be2100000000000000000000000000000000000000000000000000000000000004d2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000")',
        NodeModule
      );
    });
  });
});
