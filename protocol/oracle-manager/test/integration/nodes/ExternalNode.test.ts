import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import hre from 'hardhat';

describe('ExternalNode', function () {
  const { getContract, getSigners } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
  });

  it('can register and process an external node.', async () => {
    const [owner] = getSigners();
    const price = 100;
    const timestamp = 200;

    // Deploy the mock
    const factory = await hre.ethers.getContractFactory('MockExternalNode');
    const ValidExternalNode = await factory.connect(owner).deploy(price, timestamp);

    // Register the mock
    const NodeParameters = abi.encode(['address'], [ValidExternalNode.address]);
    const tx = await NodeModule.registerNode(NodeTypes.EXTERNAL, NodeParameters, []);
    const receipt = await tx.wait();
    const event = findSingleEvent({
      receipt,
      eventName: 'NodeRegistered',
    });

    // Verify the registration event data
    const nodeId = event.args.nodeId;
    assert.equal(event.args.nodeType, NodeTypes.EXTERNAL);
    assert.equal(event.args.parameters, NodeParameters);

    // Verify the node processes output as expected
    const output = await NodeModule.process(nodeId);
    assertBn.equal(output.price, price);
    assertBn.equal(output.timestamp, timestamp);
  });

  it('works with runtimeKeys and runtimeValues', async () => {
    const [owner] = getSigners();
    const price = 100;
    const timestamp = 200;

    // Deploy the mock
    const factory = await hre.ethers.getContractFactory('MockExternalNode');
    const ValidExternalNode = await factory.connect(owner).deploy(price, timestamp);

    // Register the mock
    const NodeParameters = abi.encode(['address'], [ValidExternalNode.address]);
    const tx = await NodeModule.registerNode(NodeTypes.EXTERNAL, NodeParameters, []);
    const receipt = await tx.wait();
    const event = findSingleEvent({
      receipt,
      eventName: 'NodeRegistered',
    });

    // Verify the registration event data
    const nodeId = event.args.nodeId;
    assert.equal(event.args.nodeType, NodeTypes.EXTERNAL);
    assert.equal(event.args.parameters, NodeParameters);

    // Verify the node processes output as expected
    const output = await NodeModule.processWithRuntime(
      nodeId,
      [ethers.utils.formatBytes32String('overridePrice')],
      [ethers.utils.hexZeroPad(ethers.BigNumber.from('100').toHexString(), 32)]
    );
    assertBn.equal(output.price, ethers.BigNumber.from('100'));
    assertBn.equal(output.timestamp, timestamp);
  });

  it('cannot be registered if it does not conform to the IExternalNode interface.', async () => {
    const [owner] = getSigners();
    const factory = await hre.ethers.getContractFactory('MockChainlinkAggregator');
    const InvalidExternalNode = await factory.connect(owner).deploy([100, 200, 300, 400, 500]);

    const invalidNodeParameters = abi.encode(['address'], [InvalidExternalNode.address]);

    await assertRevert(
      NodeModule.registerNode(NodeTypes.EXTERNAL, invalidNodeParameters, []),
      'InvalidNodeDefinition',
      NodeModule
    );
  });
});
