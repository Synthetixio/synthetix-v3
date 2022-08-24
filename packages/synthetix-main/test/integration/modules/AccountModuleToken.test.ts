import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';

import { bootstrap } from '../bootstrap';

describe('AccountModule and AccountToken', function () {
  const { signers, systems } = bootstrap();

  describe('AccountToken init', async () => {
    it('AccountToken is deployed', async () => {
      const address = await systems().Core.getAccountAddress();

      // at this point, should be equal to account module address
      assert.equal(address, systems().Account.address);
    });

    it('AccountToken parameters are correct', async () => {
      assert.equal(await systems().Account.name(), 'Synthetix Account');
      assert.equal(await systems().Account.symbol(), 'SACCT');
    });
  });

  let owner: ethers.Signer,
    user1: ethers.Signer,
    user2: ethers.Signer,
    userAdmin: ethers.Signer,
    user4: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2, userAdmin, user4] = signers();
  });

  describe('when attempting to mint an account token from the satellite', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems()
          .Account.connect(user1)
          .mint(await user1.getAddress(), 1),
        `Unauthorized("${await user1.getAddress()}")`,
        systems().Account
      );
    });
  });

  describe('When minting an AccountToken', async () => {
    let receipt: ethers.providers.TransactionReceipt;

    before('mint an accoun token', async () => {
      const tx = await systems().Core.connect(user1).createAccount(1);
      receipt = await tx.wait();
    });

    it('emitted an event', async () => {
      const event = findEvent({
        receipt,
        eventName: 'Mint',
        contract: systems().Account,
      });

      assert.equal(event.args.owner, await user1.getAddress());
      assertBn.equal(event.args.nftId, 1);
    });

    it('is created', async () => {
      assert.equal(await systems().Account.ownerOf(1), await user1.getAddress());
      assertBn.equal(await systems().Account.balanceOf(await user1.getAddress()), 1);
    });

    describe('when trying to mint the same systems().AccountId', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(user2).createAccount(1),
          'TokenAlreadyMinted("1")',
          systems().Account
        );
      });
    });

    describe('when granting roles', async () => {
      describe('before granting access', async () => {
        it('does not have granted roles', async () => {
          assert.equal(
            await systems().Core.hasRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              await user2.getAddress()
            ),
            false
          );
        });
      });

      describe('when attempting to assign a role when not authorized', async () => {
        it('reverts', async () => {
          await assertRevert(
            systems()
              .Core.connect(user2)
              .grantRole(1, ethers.utils.formatBytes32String('stake'), await user2.getAddress()),
            `RoleNotAuthorized("1", "${ethers.utils.formatBytes32String(
              'modifyPermission'
            )}", "${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });

      describe('when a role is granted/revoked', async () => {
        before('grant a role', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .grantRole(1, ethers.utils.formatBytes32String('stake'), await user2.getAddress());
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'RoleGranted' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.role, ethers.utils.formatBytes32String('stake'));
          assert.equal(event.args.target, await user2.getAddress());
          assert.equal(event.args.executedBy, await user1.getAddress());
        });

        it('shows the role granted', async () => {
          assert.equal(
            await systems().Core.hasRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              await user2.getAddress()
            ),
            true
          );
        });

        describe('when revoking the role', async () => {
          before('grant a role', async () => {
            const tx = await systems()
              .Core.connect(user1)
              .revokeRole(1, ethers.utils.formatBytes32String('stake'), await user2.getAddress());
            receipt = await tx.wait();
          });

          it('emits an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleRevoked' });

            assertBn.equal(event.args.accountId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('stake'));
            assert.equal(event.args.target, await user2.getAddress());
            assert.equal(event.args.executedBy, await user1.getAddress());
          });

          it('shows the role was revoked', async () => {
            assert.equal(
              await systems().Core.hasRole(
                1,
                ethers.utils.formatBytes32String('stake'),
                await user2.getAddress()
              ),
              false
            );
          });
        });
      });

      describe('when renouncing a role', async () => {
        before('grant a role', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .grantRole(1, ethers.utils.formatBytes32String('stake'), await user2.getAddress());
          receipt = await tx.wait();
        });

        it('shows the role granted', async () => {
          assert.equal(
            await systems().Core.hasRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              await user2.getAddress()
            ),
            true
          );
        });

        describe('when attempting to renounce a role not granted', async () => {
          it('reverts', async () => {
            await assertRevert(
              systems()
                .Core.connect(user1)
                .renounceRole(
                  1,
                  ethers.utils.formatBytes32String('stake'),
                  await user2.getAddress()
                ),
              `RoleNotAuthorized("1", "${ethers.utils.formatBytes32String(
                'renounceRole'
              )}", "${await user2.getAddress()}")`,
              systems().Core
            );
          });
        });

        describe('when renouncing the role', async () => {
          before('grant a role', async () => {
            const tx = await systems()
              .Core.connect(user2)
              .renounceRole(1, ethers.utils.formatBytes32String('stake'), await user2.getAddress());
            receipt = await tx.wait();
          });

          it('emits an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleRevoked' });

            assertBn.equal(event.args.accountId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('stake'));
            assert.equal(event.args.target, await user2.getAddress());
            assert.equal(event.args.executedBy, await user2.getAddress());
          });

          it('shows the role was revoked', async () => {
            assert.equal(
              await systems().Core.hasRole(
                1,
                ethers.utils.formatBytes32String('stake'),
                await user2.getAddress()
              ),
              false
            );
          });
        });
      });

      describe('when a "modifyPermission" role holder tries to grant more access', () => {
        before('grant "modifyPermission" role to userAdmin', async () => {
          await (
            await systems()
              .Core.connect(user1)
              .grantRole(
                1,
                ethers.utils.formatBytes32String('modifyPermission'),
                await userAdmin.getAddress()
              )
          ).wait();
        });

        before('grant another user a role', async () => {
          const tx = await await systems()
            .Core.connect(userAdmin)
            .grantRole(1, ethers.utils.formatBytes32String('another'), await user4.getAddress());
          receipt = await tx.wait();
        });

        it('emit an event', async () => {
          const event = findEvent({ receipt, eventName: 'RoleGranted' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.role, ethers.utils.formatBytes32String('another'));
          assert.equal(event.args.target, await user4.getAddress());
          assert.equal(event.args.executedBy, await userAdmin.getAddress());
        });

        it('role is granted', async () => {
          assert.equal(
            await systems().Core.hasRole(
              1,
              ethers.utils.formatBytes32String('another'),
              await user4.getAddress()
            ),
            true
          );
        });

        describe('when an admin tries to revoke more access', () => {
          before('revoke another user a role', async () => {
            const tx = await await systems()
              .Core.connect(userAdmin)
              .revokeRole(1, ethers.utils.formatBytes32String('another'), await user4.getAddress());
            receipt = await tx.wait();
          });

          it('emit an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleRevoked' });

            assertBn.equal(event.args.accountId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('another'));
            assert.equal(event.args.target, await user4.getAddress());
            assert.equal(event.args.executedBy, await userAdmin.getAddress());
          });

          it('role is revoked', async () => {
            assert.equal(
              await systems().Core.hasRole(
                1,
                ethers.utils.formatBytes32String('another'),
                await user4.getAddress()
              ),
              false
            );
          });
        });
      });
    });
  });
});
