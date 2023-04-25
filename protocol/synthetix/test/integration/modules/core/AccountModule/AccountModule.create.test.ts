import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../../../bootstrap';
import { verifyUsesFeatureFlag } from '../../../verifications';

const uint128Max = ethers.BigNumber.from(2).pow(128).sub(1);
const uint128MaxHalf = uint128Max.div(2);

describe('AccountModule', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;

  let receipt: ethers.providers.TransactionReceipt;

  describe('AccountModule - Account creation', function () {
    before('identify signers', async () => {
      [, user1, user2] = signers();
    });

    verifyUsesFeatureFlag(
      () => systems().Core,
      'createAccount',
      () => systems().Core.connect(user1)['createAccount(uint128)'](1)
    );

    describe('when user creates an account via the core system', function () {
      before('create the account', async function () {
        const tx = await systems().Core.connect(user1)['createAccount(uint128)'](1);
        receipt = await tx.wait();
      });

      it('emitted an AccountCreated event', async function () {
        await assertEvent(
          receipt,
          `AccountCreated(1, "${await user1.getAddress()}")`,
          systems().Core
        );
      });

      it('emitted a Mint event', async function () {
        await assertEvent(
          receipt,
          `Transfer("0x0000000000000000000000000000000000000000", "${await user1.getAddress()}", 1)`,
          systems().Account
        );
      });

      it('records the owner in the account system', async function () {
        assert.equal(await systems().Account.ownerOf(1), await user1.getAddress());
        assertBn.equal(await systems().Account.balanceOf(await user1.getAddress()), 1);
      });

      it('records the owner in the core system', async function () {
        assert.equal(await systems().Core.getAccountOwner(1), await user1.getAddress());
      });

      describe('when a user tries to create an account with an accountId that already exists', () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user2)['createAccount(uint128)'](1),
            'TokenAlreadyMinted("1")',
            systems().Account
          );
        });
      });

      describe('when a user tries to create an account with an accountId over the maximum', () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user2)['createAccount(uint128)'](uint128MaxHalf),
            `InvalidAccountId("${uint128MaxHalf}")`,
            systems().Account
          );

          await assertRevert(
            systems().Core.connect(user2)['createAccount(uint128)'](uint128MaxHalf.add(1)),
            `InvalidAccountId("${uint128MaxHalf.add(1)}")`,
            systems().Account
          );
        });
      });

      describe('when a user creates a series of accounts without a specified ID', () => {
        verifyUsesFeatureFlag(
          () => systems().Core,
          'createAccount',
          () => systems().Core.connect(user1)['createAccount()']()
        );

        it('succeeds with uint128MaxHalf', async () => {
          const core = systems().Core.connect(user1);

          // Get the returned accountId from the transaction
          const accountId = await core.callStatic['createAccount()']();

          const createAccountTx = await core['createAccount()']();
          const receipt = await createAccountTx.wait();

          // Check if the returned accountId is equal to uint128MaxHalf
          assert.equal(
            accountId.toString(),
            uint128MaxHalf.toString(),
            'Returned accountId should be equal to uint128MaxHalf'
          );

          // Verify the event
          await assertEvent(
            receipt,
            `AccountCreated(${uint128MaxHalf}, "${await user1.getAddress()}")`,
            systems().Core
          );
        });

        it('succeeds with uint128MaxHalf + 1', async () => {
          const core = systems().Core.connect(user1);

          // Get the returned accountId from the transaction
          const accountId = await core.callStatic['createAccount()']();

          const createAccountTx = await core['createAccount()']();
          const receipt = await createAccountTx.wait();

          // Check if the returned accountId is equal to uint128MaxHalf
          assert.equal(
            accountId.toString(),
            uint128MaxHalf.add(1).toString(),
            'Returned accountId should be equal to uint128MaxHalf.add(1)'
          );

          // Verify the event
          await assertEvent(
            receipt,
            `AccountCreated(${uint128MaxHalf.add(1)}, "${await user1.getAddress()}")`,
            systems().Core
          );
        });
      });
    });
  });
});
