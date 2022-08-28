import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

const Roles = {
  STAKE: ethers.utils.formatBytes32String('ROLE_STAKE'),
  MINT: ethers.utils.formatBytes32String('ROLE_MINT'),
};

describe.only('AccountRBACMixin', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;
  let user3: ethers.Signer;

  function canStake({ user }: { user: number }) {
    let value = Math.round(10000 * Math.random());

    describe(`when user${user} stakes`, function () {
      before('stake', async function () {
        const signer = signers()[user];

        await (await systems().Core.connect(signer).mock_AccountRBACMixin_stake(1, value));
      });

      it('sets the mock value', async function () {
        assertBn.equal(await systems().Core.mock_AccountRBACMixin_getStakeMock(), value);
      });
    });
  }

  function canMint({ user }: { user: number }) {
    let value = Math.round(10000 * Math.random());

    describe(`when user${user} mints`, function () {
      before('mint', async function () {
        const signer = signers()[user];

        await (await systems().Core.connect(signer).mock_AccountRBACMixin_mint(1, value));
      });

      it('sets the mock value', async function () {
        assertBn.equal(await systems().Core.mock_AccountRBACMixin_getMintMock(), value);
      });
    });
  }

  function cannotStake({ user }: { user: number }) {
    describe(`when user${user} tries to stake`, function () {
      it('reverts', async function () {
        const signer = signers()[user];

        await assertRevert(
          systems().Core.connect(signer).mock_AccountRBACMixin_stake(1, 666),
          `RoleNotAuthorized("1", "${Roles.STAKE}", "${await signer.getAddress()}")`,
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
          systems().Core.connect(signer).mock_AccountRBACMixin_mint(1, 666),
          `RoleNotAuthorized("1", "${Roles.MINT}", "${await signer.getAddress()}")`,
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
      canStake({ user: 1 });
      canMint({ user: 1 });
      cannotStake({ user: 2 });
      cannotMint({ user: 2 });
      cannotStake({ user: 3 });
      cannotMint({ user: 3 });
    });

    describe('when granting stake access to user2', function () {
      before('grant', async function () {
        await (await systems().Core.connect(user1).grantRole(1, Roles.STAKE, await user2.getAddress())).wait();
      });

      canStake({ user: 1 });
      canMint({ user: 1 });
      canStake({ user: 2 });
      cannotMint({ user: 2 });
      cannotStake({ user: 3 });
      cannotMint({ user: 3 });

      describe('when granting mint access to user2', function () {
        before('grant', async function () {
          await (await systems().Core.connect(user1).grantRole(1, Roles.MINT, await user2.getAddress())).wait();
        });

        canStake({ user: 1 });
        canMint({ user: 1 });
        canStake({ user: 2 });
        canMint({ user: 2 });
        cannotStake({ user: 3 });
        cannotMint({ user: 3 });

        describe('when revoking stake access from user2', function () {
          before('revoke', async function () {
            await (await systems().Core.connect(user1).revokeRole(1, Roles.STAKE, await user2.getAddress())).wait();
          });

          canStake({ user: 1 });
          canMint({ user: 1 });
          canMint({ user: 2 });
          cannotStake({ user: 2 });
          cannotStake({ user: 3 });
          cannotMint({ user: 3 });

          describe('when granting stake access to user3', function () {
            before('grant', async function () {
              await (await systems().Core.connect(user1).grantRole(1, Roles.STAKE, await user3.getAddress())).wait();
            });

            canStake({ user: 1 });
            canMint({ user: 1 });
            canMint({ user: 2 });
            cannotStake({ user: 2 });
            canStake({ user: 3 });
            cannotMint({ user: 3 });

            describe('when the account owner transfers the account to user3', function () {
              before('transfer account', async function () {
                await (await systems().Account.connect(user1).transferFrom(
                  await user1.getAddress(),
                  await user3.getAddress(),
                  1
                )).wait();
              });

              cannotStake({ user: 1 });
              cannotMint({ user: 1 });
              canMint({ user: 2 });
              cannotStake({ user: 2 });
              canStake({ user: 3 });
              canMint({ user: 3 });
            });
          });
        });
      });
    });
  });
});
