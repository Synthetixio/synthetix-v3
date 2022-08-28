import assert from 'assert/strict';
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

  describe('AccountRBACMixin', function () {
    before('identify signers', async () => {
      [, user1, user2] = signers();
    });

    before('create an account', async () => {
      await (await systems().Core.connect(user1).createAccount(1)).wait();
    });

    describe('when an unauthorized user interacts with the account', function () {
      describe('trying to set value A', function () {
        it('reverts', async function () {
          await assertRevert(
            systems().Core.connect(user2).mock_AccountRBACMixin_stake(1, 666),
            `RoleNotAuthorized("1", "${Roles.STAKE}", "${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });

      describe('trying to set value B', function () {
        it('reverts', async function () {
          await assertRevert(
            systems().Core.connect(user2).mock_AccountRBACMixin_mint(1, 666),
            `RoleNotAuthorized("1", "${Roles.MINT}", "${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });
    });

    describe('when the owner interacts with the account', function () {
      describe('staking', function () {
        before('stake', async function () {
          await (await systems().Core.connect(user1).mock_AccountRBACMixin_stake(1, 1337));
        });

        it('sets the stake mock value', async function () {
          assertBn.equal(await systems().Core.mock_AccountRBACMixin_getStakeMock(), 1337);
        });
      });

      describe('minting', function () {
        before('mint', async function () {
          await (await systems().Core.connect(user1).mock_AccountRBACMixin_mint(1, 33));
        });

        it('sets the mint mock value', async function () {
          assertBn.equal(await systems().Core.mock_AccountRBACMixin_getMintMock(), 33);
        });
      });
    });

    describe('when the owner grants access to another accout', function () {
      describe('granting stake access', function () {
        before('grant', async function () {
          await (await systems().Core.connect(user1).grantRole(1, Roles.STAKE, await user2.getAddress())).wait();
        });

        describe('when the authorized user uses stake access', function () {
          before('stake', async function () {
            await (await systems().Core.connect(user1).mock_AccountRBACMixin_stake(1, 42));
          });

          it('sets the stake mock value', async function () {
            assertBn.equal(await systems().Core.mock_AccountRBACMixin_getStakeMock(), 42);
          });
        });

        describe('when the authorized user tries to use mint access', function () {
          it('reverts', async function () {
            await assertRevert(
              systems().Core.connect(user2).mock_AccountRBACMixin_mint(1, 666),
              `RoleNotAuthorized("1", "${Roles.MINT}", "${await user2.getAddress()}")`,
              systems().Core
            );
          });
        });
      });
    });
  });
});
