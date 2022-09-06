import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

const Permissions = {
  DEPOSIT: ethers.utils.formatBytes32String('DEPOSIT'),
  MINT: ethers.utils.formatBytes32String('MINT'),
};

describe('AccountRBACMixin', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;
  let user3: ethers.Signer;

  function canDeposit({ user }: { user: number }) {
    const value = Math.round(10000 * Math.random());

    describe(`when user${user} deposits`, function () {
      before('deposit', async function () {
        const signer = signers()[user];

        await await systems().Core.connect(signer).mockAccountRBACMixinDeposit(1, value);
      });

      it('sets the mock value', async function () {
        assertBn.equal(await systems().Core.mockAccountRBACMixinGetDepositMock(), value);
      });
    });
  }

  function canMint({ user }: { user: number }) {
    const value = Math.round(10000 * Math.random());

    describe(`when user${user} mints`, function () {
      before('mint', async function () {
        const signer = signers()[user];

        await await systems().Core.connect(signer).mockAccountRBACMixinMint(1, value);
      });

      it('sets the mock value', async function () {
        assertBn.equal(await systems().Core.mockAccountRBACMixinGetMintMock(), value);
      });
    });
  }

  function cannotDeposit({ user }: { user: number }) {
    describe(`when user${user} tries to deposit`, function () {
      it('reverts', async function () {
        const signer = signers()[user];

        await assertRevert(
          systems().Core.connect(signer).mockAccountRBACMixinDeposit(1, 666),
          `PermissionDenied("1", "${Permissions.DEPOSIT}", "${await signer.getAddress()}")`,
          systems().Core
        );
      });
    });
  }

  function cannotMint({ user }: { user: number }) {
    describe(`when user${user} tries to mint`, function () {
      it('reverts', async function () {
        const signer = signers()[user];

        await assertRevert(
          systems().Core.connect(signer).mockAccountRBACMixinMint(1, 666),
          `PermissionDenied("1", "${Permissions.MINT}", "${await signer.getAddress()}")`,
          systems().Core
        );
      });
    });
  }

  describe('AccountRBACMixin', function () {
    before('identify signers', async () => {
      [, user1, user2, user3] = signers();
    });

    before('create an account', async () => {
      await (await systems().Core.connect(user1).createAccount(1)).wait();
    });

    describe('before granting access to any account', function () {
      canDeposit({ user: 1 });
      canMint({ user: 1 });
      cannotDeposit({ user: 2 });
      cannotMint({ user: 2 });
      cannotDeposit({ user: 3 });
      cannotMint({ user: 3 });
    });

    describe('when granting deposit access to user2', function () {
      before('grant', async function () {
        await (
          await systems()
            .Core.connect(user1)
            .grantPermission(1, Permissions.DEPOSIT, await user2.getAddress())
        ).wait();
      });

      canDeposit({ user: 1 });
      canMint({ user: 1 });
      canDeposit({ user: 2 });
      cannotMint({ user: 2 });
      cannotDeposit({ user: 3 });
      cannotMint({ user: 3 });

      describe('when granting mint access to user2', function () {
        before('grant', async function () {
          await (
            await systems()
              .Core.connect(user1)
              .grantPermission(1, Permissions.MINT, await user2.getAddress())
          ).wait();
        });

        canDeposit({ user: 1 });
        canMint({ user: 1 });
        canDeposit({ user: 2 });
        canMint({ user: 2 });
        cannotDeposit({ user: 3 });
        cannotMint({ user: 3 });

        describe('when revoking deposit access from user2', function () {
          before('revoke', async function () {
            await (
              await systems()
                .Core.connect(user1)
                .revokePermission(1, Permissions.DEPOSIT, await user2.getAddress())
            ).wait();
          });

          canDeposit({ user: 1 });
          canMint({ user: 1 });
          canMint({ user: 2 });
          cannotDeposit({ user: 2 });
          cannotDeposit({ user: 3 });
          cannotMint({ user: 3 });

          describe('when granting deposit access to user3', function () {
            before('grant', async function () {
              await (
                await systems()
                  .Core.connect(user1)
                  .grantPermission(1, Permissions.DEPOSIT, await user3.getAddress())
              ).wait();
            });

            canDeposit({ user: 1 });
            canMint({ user: 1 });
            canMint({ user: 2 });
            cannotDeposit({ user: 2 });
            canDeposit({ user: 3 });
            cannotMint({ user: 3 });

            describe('when the account owner transfers the account to user3', function () {
              before('transfer account', async function () {
                await (
                  await systems()
                    .Account.connect(user1)
                    .transferFrom(await user1.getAddress(), await user3.getAddress(), 1)
                ).wait();
              });

              cannotDeposit({ user: 1 });
              cannotMint({ user: 1 });
              canMint({ user: 2 });
              cannotDeposit({ user: 2 });
              canDeposit({ user: 3 });
              canMint({ user: 3 });
            });
          });
        });
      });
    });
  });
});
