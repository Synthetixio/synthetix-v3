import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../../../bootstrap';

describe('AccountModule', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;

  let receipt: ethers.providers.TransactionReceipt;

  describe('AccountModule - Account creation', function () {
    before('identify signers', async () => {
      [, user1, user2] = signers();
    });

    describe('when user creates an account via the core system', function () {
      before('create the account', async function () {
        const tx = await systems().Core.connect(user1).createAccount(1);
        receipt = await tx.wait();
      });

      it('emitted an AccountCreated event', async function () {
        assertEvent(receipt, `AccountCreated(${await user1.getAddress()}, "1")`, systems().Core);
      });

      it('emitted a Mint event', async function () {
        assertEvent(
          receipt,
          `Transfer("0x0000000000000000000000000000000000000000", ${await user1.getAddress()}, "1")`,
          systems().Core
        );
      });

      it('records the owner in the account system', async function () {
        assert.equal(await systems().Account.ownerOf(1), await user1.getAddress());
        assertBn.equal(await systems().Account.balanceOf(await user1.getAddress()), 1);
      });

      it('records the owner in the core system', async function () {
        assert.equal(await systems().Core.getAccountOwner(1), await user1.getAddress());
      });

      describe('when a user tries to create an acccount with an accountId that already exists', () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user2).createAccount(1),
            'TokenAlreadyMinted("1")',
            systems().Account
          );
        });
      });
    });
  });
});
