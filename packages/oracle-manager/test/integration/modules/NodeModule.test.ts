import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../bootstrap';

describe('NodeModule', function () {
  const { signers, systems, poolId } = bootstrapWithNodes();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: number;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  it('test', async () => {
    assertBn.equal(0, 0);
  });
});
