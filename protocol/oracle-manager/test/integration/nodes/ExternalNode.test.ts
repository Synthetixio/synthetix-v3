import assert from 'assert/strict';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';

describe('ExternalNode', function () {
  const { getContract, getSigners } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
  });

  it('can register and process and external node.', async () => {
    const [owner] = getSigners();
    const MockExternalNodeOutputData = abi.encode(
      ['tuple(int256, uint256, uint256, uint256)'],
      [[ethers.utils.parseEther('1'), ethers.utils.parseEther('2'), 0, 0]]
    );
    const factory = await hre.ethers.getContractFactory('MockExternalNode');
    const ValidExternalNode = await factory.connect(owner).deploy([MockExternalNodeOutputData]);

    const NodeParameters = abi.encode(['address'], [ValidExternalNode.address]);
    const tx = await NodeModule.registerNode(NodeTypes.EXTERNAL, NodeParameters, []);
    const receipt = await tx.wait();
    const event = findSingleEvent({
      receipt,
      eventName: 'NodeRegistered',
    });
    const nodeId = event.args.nodeId;
    assert.equal(event.args.nodeType, NodeTypes.EXTERNAL);
    assert.equal(event.args.parameters, NodeParameters);

    const output = await NodeModule.process(nodeId);
    // TODO: assert price and timestamp and accurate
  });

  it('cannot be registered if it does not conform to the IExternalNode interface.', async () => {
    const [owner] = getSigners();
    const factory = await hre.ethers.getContractFactory('MockChainlinkAggregator');
    const InvalidExternalNode = await factory.connect(owner).deploy([100, 200, 300, 400, 500]);

    const invalidNodeParameters = abi.encode(['address'], [InvalidExternalNode.address]);

    await assertRevert(
      NodeModule.registerNode(NodeTypes.EXTERNAL, invalidNodeParameters, []),
      `IncorrectExternalNodeInterface("${InvalidExternalNode.address}")`,
      NodeModule
    );
  });
});
