import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import hre from 'hardhat';

describe('ExternalNode', function () {
  const { getContract } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
  });

  it('can register and process an constant node.', async () => {
    const price = 100;

    // Register the node
    const NodeParameters = abi.encode(['int256'], [price]);
    const tx = await NodeModule.registerNode(NodeTypes.CONSTANT, NodeParameters, []);
    const receipt = await tx.wait();
    const event = findSingleEvent({
      receipt,
      eventName: 'NodeRegistered',
    });

    // Verify the registration event data
    const nodeId = event.args.nodeId;
    assert.equal(event.args.nodeType, NodeTypes.CONSTANT);
    assert.equal(event.args.parameters, NodeParameters);

    // Verify the node processes output as expected
    const timestamp = (await hre.ethers.provider.getBlock('latest')).timestamp;
    const output = await NodeModule.process(nodeId);
    assertBn.equal(output.price, price);
    assertBn.equal(output.timestamp, timestamp);
  });
});
