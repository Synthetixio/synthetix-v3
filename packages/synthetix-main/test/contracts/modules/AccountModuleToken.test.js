const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('AccountModule - AccountToken', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1, user2, userAdmin, user4;

  let AccountModule, accountTokenAddress, AccountToken;

  before('identify signers', async () => {
    [owner, user1, user2, userAdmin, user4] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
  });

  before('Initialize (Create a AccountToken token)', async () => {
    await (await AccountModule.connect(owner).initializeAccountModule()).wait();
    accountTokenAddress = await AccountModule.getAccountAddress();

    AccountToken = await ethers.getContractAt('AccountToken', accountTokenAddress);
  });

  describe('When minting an AccountToken', async () => {
    let receipt;

    before('mint an accoun token', async () => {
      const tx = await AccountToken.connect(user1).createAccount(user1.address, 1);
      receipt = await tx.wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'AccountMinted', contract: AccountToken });

      assert.equal(event.args.owner, user1.address);
      assertBn.equal(event.args.accountId, 1);
    });

    it('is created', async () => {
      assert.equal(await AccountToken.ownerOf(1), user1.address);
      assertBn.equal(await AccountToken.balanceOf(user1.address), 1);
    });

    describe('when trying to mint the same AccountTokenId', () => {
      it('reverts', async () => {
        await assertRevert(AccountModule.connect(user2).createAccount(1), 'TokenAlreadyMinted(1)');
      });
    });

    describe('when attempting to call transferAccount directly', async () => {
      it('reverts', async () => {
        await assertRevert(
          AccountModule.connect(user1).transferAccount(user2.address, 1),
          `OnlyTokenProxyAllowed("${user1.address}")`
        );
      });
    });

    describe('when granting roles', async () => {
      describe('before granting access', async () => {
        it('does not have granted roles', async () => {
          assert.equal(
            await AccountModule.hasRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              user2.address
            ),
            false
          );
        });
      });

      describe('when attempting to assign a role when not authorized', async () => {
        it('reverts', async () => {
          await assertRevert(
            AccountModule.connect(user2).grantRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              user2.address
            ),
            `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String('modifyPermission')}", "${
              user2.address
            }")`
          );
        });
      });

      describe('when a role is granted/revoked', async () => {
        before('grant a role', async () => {
          const tx = await AccountModule.connect(user1).grantRole(
            1,
            ethers.utils.formatBytes32String('stake'),
            user2.address
          );
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'RoleGranted' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.role, ethers.utils.formatBytes32String('stake'));
          assert.equal(event.args.target, user2.address);
          assert.equal(event.args.executedBy, user1.address);
        });

        it('shows the role granted', async () => {
          assert.equal(
            await AccountModule.hasRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              user2.address
            ),
            true
          );
        });

        describe('when revoking the role', async () => {
          before('grant a role', async () => {
            const tx = await AccountModule.connect(user1).revokeRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              user2.address
            );
            receipt = await tx.wait();
          });

          it('emits an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleRevoked' });

            assertBn.equal(event.args.accountId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('stake'));
            assert.equal(event.args.target, user2.address);
            assert.equal(event.args.executedBy, user1.address);
          });

          it('shows the role was revoked', async () => {
            assert.equal(
              await AccountModule.hasRole(
                1,
                ethers.utils.formatBytes32String('stake'),
                user2.address
              ),
              false
            );
          });
        });
      });

      describe('when renouncing a role', async () => {
        before('grant a role', async () => {
          const tx = await AccountModule.connect(user1).grantRole(
            1,
            ethers.utils.formatBytes32String('stake'),
            user2.address
          );
          receipt = await tx.wait();
        });

        it('shows the role granted', async () => {
          assert.equal(
            await AccountModule.hasRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              user2.address
            ),
            true
          );
        });

        describe('when attempting to renounce a role not granted', async () => {
          it('reverts', async () => {
            await assertRevert(
              AccountModule.connect(user1).renounceRole(
                1,
                ethers.utils.formatBytes32String('stake'),
                user2.address
              ),
              `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String('renounceRole')}", "${
                user2.address
              }")`
            );
          });
        });

        describe('when renouncing the role', async () => {
          before('grant a role', async () => {
            const tx = await AccountModule.connect(user2).renounceRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              user2.address
            );
            receipt = await tx.wait();
          });

          it('emits an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleRevoked' });

            assertBn.equal(event.args.accountId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('stake'));
            assert.equal(event.args.target, user2.address);
            assert.equal(event.args.executedBy, user2.address);
          });

          it('shows the role was revoked', async () => {
            assert.equal(
              await AccountModule.hasRole(
                1,
                ethers.utils.formatBytes32String('stake'),
                user2.address
              ),
              false
            );
          });
        });
      });

      describe('when a "modifyPermission" role holder tries to grant more access', () => {
        before('grant "modifyPermission" role to userAdmin', async () => {
          await (
            await AccountModule.connect(user1).grantRole(
              1,
              ethers.utils.formatBytes32String('modifyPermission'),
              userAdmin.address
            )
          ).wait();
        });

        before('grant another user a role', async () => {
          const tx = await await AccountModule.connect(userAdmin).grantRole(
            1,
            ethers.utils.formatBytes32String('another'),
            user4.address
          );
          receipt = await tx.wait();
        });

        it('emit an event', async () => {
          const event = findEvent({ receipt, eventName: 'RoleGranted' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.role, ethers.utils.formatBytes32String('another'));
          assert.equal(event.args.target, user4.address);
          assert.equal(event.args.executedBy, userAdmin.address);
        });

        it('role is granted', async () => {
          assert.equal(
            await AccountModule.hasRole(
              1,
              ethers.utils.formatBytes32String('another'),
              user4.address
            ),
            true
          );
        });

        describe('when an admin tries to revoke more access', () => {
          before('revoke another user a role', async () => {
            const tx = await await AccountModule.connect(userAdmin).revokeRole(
              1,
              ethers.utils.formatBytes32String('another'),
              user4.address
            );
            receipt = await tx.wait();
          });

          it('emit an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleRevoked' });

            assertBn.equal(event.args.accountId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('another'));
            assert.equal(event.args.target, user4.address);
            assert.equal(event.args.executedBy, userAdmin.address);
          });

          it('role is revoked', async () => {
            assert.equal(
              await AccountModule.hasRole(
                1,
                ethers.utils.formatBytes32String('another'),
                user4.address
              ),
              false
            );
          });
        });
      });
    });
  });
});
