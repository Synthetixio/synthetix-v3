const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('AccountRBACMixin', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1, user2, user3;

  let AccountModule, accountTokenAddress, AccountToken;
  let AccountRBACMixinMock;

  before('identify signers', async () => {
    [owner, user1, user2, user3] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
    await (await AccountModule.connect(owner).initializeAccountModule()).wait();
    accountTokenAddress = await AccountModule.getAccountAddress();

    AccountToken = await ethers.getContractAt('AccountToken', accountTokenAddress);

    AccountRBACMixinMock = await ethers.getContractAt('AccountRBACMixinModuleMock', proxyAddress());
  });

  before('mint an account token', async () => {
    await (await AccountToken.connect(user1).mint(user1.address, 1)).wait();
  });

  it('is minted', async () => {
    assert.equal(await AccountToken.ownerOf(1), user1.address);
    assertBn.equal(await AccountToken.balanceOf(user1.address), 1);
  });

  describe('when accessing as owner', () => {
    it('can interact with the contract', async () => {
      await (await AccountRBACMixinMock.connect(user1).interactWithAccount(1, 42)).wait();
      assertBn.equal(await AccountRBACMixinMock.getRBACValue(), 42);
    });

    describe('when attempting to interact as non owner', async () => {
      it('reverts', async () => {
        await assertRevert(
          AccountRBACMixinMock.connect(user2).interactWithAccount(1, 1337),
          `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String('stake')}", "${user2.address}")`
        );
      });
    });

    describe('when transfering ownership of accountToken', async () => {
      before('transfer to user2', async () => {
        await (
          await AccountToken.connect(user1).transferFrom(user1.address, user2.address, 1)
        ).wait();
      });

      after('transfer back to user1', async () => {
        await (
          await AccountToken.connect(user2).transferFrom(user2.address, user1.address, 1)
        ).wait();
      });

      it('can interact with the contract', async () => {
        await (await AccountRBACMixinMock.connect(user2).interactWithAccount(1, 43)).wait();
        assertBn.equal(await AccountRBACMixinMock.getRBACValue(), 43);
      });

      describe('when attempting to interact as non owner', async () => {
        it('reverts', async () => {
          await assertRevert(
            AccountRBACMixinMock.connect(user1).interactWithAccount(1, 1337),
            `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String('stake')}", "${
              user1.address
            }")`
          );
        });
      });
    });

    describe('when granting access', async () => {
      before('grant access to some users', async () => {
        await (
          await AccountModule.connect(user1).grantRole(
            1,
            ethers.utils.formatBytes32String('stake'),
            user2.address
          )
        ).wait();

        await (
          await AccountModule.connect(user1).grantRole(
            1,
            ethers.utils.formatBytes32String('otherRole'),
            user3.address
          )
        ).wait();
      });

      it('can interact with the contract', async () => {
        await (await AccountRBACMixinMock.connect(user2).interactWithAccount(1, 44)).wait();
        assertBn.equal(await AccountRBACMixinMock.getRBACValue(), 44);
      });

      describe('when attempting to interact as non owner / non authorized with that role', async () => {
        it('reverts', async () => {
          await assertRevert(
            AccountRBACMixinMock.connect(user3).interactWithAccount(1, 1337),
            `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String('stake')}", "${
              user3.address
            }")`
          );
        });
      });

      describe('when attempting to access after the role was revoked', async () => {
        before('revoke access to user2', async () => {
          await (
            await AccountModule.connect(user1).revokeRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              user2.address
            )
          ).wait();
        });

        it('reverts', async () => {
          await assertRevert(
            AccountRBACMixinMock.connect(user2).interactWithAccount(1, 1337),
            `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String('stake')}", "${
              user2.address
            }")`
          );
        });
      });
    });
  });
});
