import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';

describe('NodeModule', function () {
  const { signers, systems, nodeId1, nodeId2 } = bootstrapWithNodes();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: number;

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
});
