import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { bootstrap } from '../../../bootstrap';

describe('AccountModule', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;

  describe('AccountModule - Account transfering', function () {
    before('identify signers', async () => {
      [, user1, user2] = signers();
    });

    before('create the account', async function () {
      await systems().Core.connect(user1).createAccount(1);
    });

    describe('when an account NFT is transferred', function () {
      before('transfer the account', async function () {
        await systems()
          .Account.connect(user1)
          .transferFrom(await user1.getAddress(), await user2.getAddress(), 1);
      });

      it('records the new owner in the account system', async function () {
        assert.equal(await systems().Account.ownerOf(1), await user2.getAddress());
        assertBn.equal(await systems().Account.balanceOf(await user2.getAddress()), 1);

        assertBn.equal(await systems().Account.balanceOf(await user1.getAddress()), 0);
      });

      it('records the new owner in the core system', async function () {
        assert.equal(await systems().Core.accountOwner(1), await user2.getAddress());
      });
    });
  });
});
