import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../bootstrap';

describe('USDTokenModule', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer, user1: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  describe('mintInitialSystemToken()', () => {
    it('only the owner can call', async () => {
      assertRevert(
        systems()
          .Core.connect(user1)
          .mintInitialSystemToken(await owner.getAddress(), 1e18),
        'Unauthorized',
        systems().Core
      );
    });

    it('works when totalSupply is 0', async () => {
      const amount = ethers.utils.parseEther('1');

      await systems()
        .Core.connect(owner)
        .mintInitialSystemToken(await user1.getAddress(), amount);
      assertBn.equal(await systems().SNX.balanceOf(await user1.getAddress()), amount);
    });

    it('reverts when totalSupply is not 0', async () => {
      assertRevert(
        systems()
          .Core.connect(owner)
          .mintInitialSystemToken(await user1.getAddress(), 1e18),
        'AlreadyInitialized',
        systems().Core
      );
    });
  });
});
