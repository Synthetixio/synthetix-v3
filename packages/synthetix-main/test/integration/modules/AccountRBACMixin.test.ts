import assert from 'assert/strict';
import assertBn from '@synthetixio/core-js/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-js/utils/assertions/assert-revert';
import { bootstrap } from '../bootstrap';
import { ethers } from 'ethers';

// TODO
describe.skip('AccountRBACMixin', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer,
    user1: ethers.Signer,
    user2: ethers.Signer,
    user3: ethers.Signer;

  let AccountRBACMixinMock: ethers.Contract;

  before('identify signers', async () => {
    [owner, user1, user2, user3] = signers();
  });

  before('mint an account token', async () => {
    await (await systems().Core.connect(user1).createAccount(1)).wait();
  });

  it('is minted', async () => {
    assert.equal(await systems().Account.ownerOf(1), await user1.getAddress());
    assertBn.equal(
      await systems().Account.balanceOf(await user1.getAddress()),
      1
    );
  });

  describe('when accessing as owner', () => {
    it('can interact with the contract', async () => {
      await (
        await AccountRBACMixinMock.connect(user1).interactWithAccount(1, 42)
      ).wait();
      assertBn.equal(await AccountRBACMixinMock.getRBACValue(), 42);
    });

    describe('when attempting to interact as non owner', async () => {
      it('reverts', async () => {
        await assertRevert(
          AccountRBACMixinMock.connect(user2).interactWithAccount(1, 1337),
          `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String(
            'stake'
          )}", "${user2.getAddress()}")`
        );
      });
    });

    describe('when transfering ownership of systems().Account', async () => {
      before('transfer to user2', async () => {
        await (
          await systems()
            .Account.connect(user1)
            .transferFrom(user1.getAddress(), user2.getAddress(), 1)
        ).wait();
      });

      after('transfer back to user1', async () => {
        await (
          await systems()
            .Account.connect(user2)
            .transferFrom(user2.getAddress(), user1.getAddress(), 1)
        ).wait();
      });

      it('can interact with the contract', async () => {
        await (
          await AccountRBACMixinMock.connect(user2).interactWithAccount(1, 43)
        ).wait();
        assertBn.equal(await AccountRBACMixinMock.getRBACValue(), 43);
      });

      describe('when attempting to interact as non owner', async () => {
        it('reverts', async () => {
          await assertRevert(
            AccountRBACMixinMock.connect(user1).interactWithAccount(1, 1337),
            `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String(
              'stake'
            )}", "${await user1.getAddress()}")`
          );
        });
      });
    });

    describe('when granting access', async () => {
      before('grant', async () => {
        await (
          await systems()
            .Core.connect(user1)
            .grantRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              await user2.getAddress()
            )
        ).wait();

        await (
          await systems()
            .Core.connect(user1)
            .grantRole(
              1,
              ethers.utils.formatBytes32String('otherRole'),
              await user3.getAddress()
            )
        ).wait();
      });

      it('can interact with the contract', async () => {
        await (
          await AccountRBACMixinMock.connect(user2).interactWithAccount(1, 44)
        ).wait();
        assertBn.equal(await AccountRBACMixinMock.getRBACValue(), 44);
      });

      describe('when attempting to interact as non owner / non authorized with that role', async () => {
        it('reverts', async () => {
          await assertRevert(
            AccountRBACMixinMock.connect(user3).interactWithAccount(1, 1337),
            `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String(
              'stake'
            )}", "${await user3.getAddress()}")`
          );
        });
      });

      describe('when attempting to access after the role was revoked', async () => {
        before('revoke access to user2', async () => {
          await (
            await systems()
              .Core.connect(user1)
              .revokeRole(
                1,
                ethers.utils.formatBytes32String('stake'),
                await user2.getAddress()
              )
          ).wait();
        });

        it('reverts', async () => {
          await assertRevert(
            AccountRBACMixinMock.connect(user2).interactWithAccount(1, 1337),
            `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String(
              'stake'
            )}", "${await user2.getAddress()}")`
          );
        });
      });
    });
  });
});
