import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { bootstrap } from '../bootstrap';

describe.only('AccountModule and AccountTokenModule', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;

  let receipt: ethers.providers.TransactionReceipt;

  const Roles = {
    MODIFY: "ROLE_MODIFY",
    STAKE: "ROLE_STAKE",
    UNSTAKE: "ROLE_UNSTAKE",
    ASSIGN: "ROLE_ASSIGN",
    MINT: "ROLE_MINT",
  };

  before('identify signers', async () => {
    [, user1, user2] = signers();
  });

  describe('when the core and account systems are deployed and set up', function () {
    it('sets the account system address in the core system', async function () {
      assert.equal(await systems().Core.getAccountTokenAddress(), systems().Account.address);
    });

    it('sets the core system as the owner of the account system', async function () {
      assert.equal(await systems().Account.owner(), systems().Core.address);
    });

    it('initializes the account system correctly', async function () {
      assert.equal(await systems().Account.name(), 'Synthetix Account');
      assert.equal(await systems().Account.symbol(), 'SACCT');
    });

    describe('when a user attempts to mint an account token via the account system directly', async function () {
      it('reverts', async function () {
        await assertRevert(
          systems()
            .Account.connect(user1)
            .mint(await user1.getAddress(), 1),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Account
        );
      });
    });

    describe('when user creates an account via the core system', function () {
      before('create the account', async function () {
        const tx = await systems().Core.connect(user1).createAccount(1);
        receipt = await tx.wait();
      });

      it('emitted an AccountCreated event', async function () {
        const event = findEvent({
          receipt,
          eventName: 'AccountCreated',
        });

        assert.equal(event.args.sender, await user1.getAddress());
        assertBn.equal(event.args.accountId, 1);
      });

      // Bug in util
      it.skip('emitted a Mint event', async function () {
        const event = findEvent({
          receipt,
          eventName: 'Mint',
          contract: systems().Account
        });

        assert.equal(event.args.owner, await user1.getAddress());
        assertBn.equal(event.args.tokenId, 1);
      });

      it('records the owner in the account system', async function () {
        assert.equal(await systems().Account.ownerOf(1), await user1.getAddress());
        assertBn.equal(await systems().Account.balanceOf(await user1.getAddress()), 1);
      });

      it('records the owner in the core system', async function () {
        assert.equal(await systems().Core.accountOwner(1), await user1.getAddress());
      });

      describe('when a user tries to create an acccount that already exists', () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user2).createAccount(1),
            'TokenAlreadyMinted("1")',
            systems().Account
          );
        });
      });

      describe('before roles have been granted', function () {
        it('shows that certain roles have not been granted', async () => {
          async function assertDoesNotHaveRole(accountAddress: string, accountId: number, role: string) {
            assert.equal(
              await systems().Core.hasRole(
                accountId,
                ethers.utils.formatBytes32String(role),
                accountAddress
              ),
              false
            );
          }

          const userAddress = await user1.getAddress();
          await assertDoesNotHaveRole(userAddress, 1, Roles.STAKE);
          await assertDoesNotHaveRole(userAddress, 1, Roles.MODIFY);
          await assertDoesNotHaveRole(userAddress, 1, Roles.ASSIGN);
        });
      });

      describe('when a non-authorized user attempts to grant roles', async () => {
        it('reverts', async () => {
          await assertRevert(
            systems()
              .Core.connect(user2)
              .grantRole(1, ethers.utils.formatBytes32String(Roles.STAKE), await user2.getAddress()),
            `RoleNotAuthorized("1", "${ethers.utils.formatBytes32String(
              Roles.MODIFY
            )}", "${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });

      describe('when an account NFT is transferred', function () {
        before('transfer the account', async function () {
          await systems().Account.connect(user1).transferFrom(await user1.getAddress(), await user2.getAddress(), 1);
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
});
