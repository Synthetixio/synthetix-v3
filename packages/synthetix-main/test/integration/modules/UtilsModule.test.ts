import assert from 'assert/strict';
import { bootstrap } from '../bootstrap';
import { ethers } from 'ethers';
import assertRevert from '@synthetixio/core-js/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-js/utils/assertions/assert-bignumber';

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
      assertBn.equal(
        await systems().SNX.balanceOf(await user1.getAddress()),
        amount
      );
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
