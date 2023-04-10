import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { bootstrap } from '../../../bootstrap';
import Permissions from '../../../mixins/AccountRBACMixin.permissions';

describe('AccountModule', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;
  let user3: ethers.Signer;

  describe('AccountModule - Account transfering', function () {
    before('identify signers', async () => {
      [, user1, user2, user3] = signers();
    });

    before('create the account', async function () {
      await systems().Core.connect(user1)['createAccount(uint128)'](1);
    });

    before('grant some permissions', async () => {
      await systems()
        .Core.connect(user1)
        .grantPermission(1, Permissions.REWARDS, await user1.getAddress());
      await systems()
        .Core.connect(user1)
        .grantPermission(1, Permissions.WITHDRAW, await user3.getAddress());
      await systems()
        .Core.connect(user1)
        .grantPermission(1, Permissions.DELEGATE, await user3.getAddress());
    });

    describe('when an account NFT is transferred', function () {
      before('transfer the account', async function () {
        const tx = await systems()
          .Core.connect(user1)
          .grantPermission(1, Permissions.DELEGATE, await user1.getAddress());
        await tx.wait();

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
        assert.equal(await systems().Core.getAccountOwner(1), await user2.getAddress());
      });

      it('shows the previous owner permissions have been revoked', async () => {
        assert.equal(
          await systems().Core.hasPermission(1, Permissions.DELEGATE, await user1.getAddress()),
          false
        );
      });

      it('shows that other accounts permissions have been revoked', async () => {
        assert.equal(
          await systems().Core.hasPermission(1, Permissions.WITHDRAW, await user3.getAddress()),
          false
        );
        assert.equal(
          await systems().Core.hasPermission(1, Permissions.ADMIN, await user3.getAddress()),
          false
        );
      });
    });
  });
});
