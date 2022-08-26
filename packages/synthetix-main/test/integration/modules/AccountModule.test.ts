import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

describe.only('AccountModule and AccountTokenModule', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer;
  let user1: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  describe('when the core and account systems are deployed', () => {
    it('sets the account system address in the core system', async () => {
      assert.equal(await systems().Core.getAccountTokenAddress(), systems().Account.address);
    });

    it('sets the core system as the owner of the account system', async () => {
      assert.equal(await systems().Account.owner(), systems().Core.address);
    });

    describe('when creating an account', () => {
      before('create account', async () => {
        await systems().Core.connect(user1).createAccount(1);
      });

      it('records the owner in the account system', async () => {
        assert.equal(await systems().Account.ownerOf(1), await user1.getAddress());
        assertBn.equal(await systems().Account.balanceOf(await user1.getAddress()), 1);
      });

      it('records the owner in the core system', async () => {
        assert.equal(await systems().Core.accountOwner(1), await user1.getAddress());
      });
    });
  });
});
