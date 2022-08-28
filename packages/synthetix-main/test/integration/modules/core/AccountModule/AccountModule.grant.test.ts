import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { takeSnapshot, restoreSnapshot } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { bootstrap } from '../../../bootstrap';

describe('AccountModule', function () {
  const { signers, systems, provider } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;

  let receipt: ethers.providers.TransactionReceipt;

  let snapshotId: number;

  const Roles = {
    MODIFY: ethers.utils.formatBytes32String('ROLE_MODIFY'),
    STAKE: ethers.utils.formatBytes32String('ROLE_STAKE'),
  };

  describe('AccountModule - Granting, revoking, and renouncing roles', function () {
    before('identify signers', async () => {
      [, user1, user2] = signers();
    });

    before('create the account', async function () {
      const tx = await systems().Core.connect(user1).createAccount(1);
      receipt = await tx.wait();
    });

    describe('before roles have been granted', function () {
      it('shows that certain roles have not been granted', async () => {
        assert.equal(
          await systems().Core.hasRole(
            1,
            Roles.STAKE,
            await user1.getAddress()
          ),
          false
        );
        assert.equal(
          await systems().Core.hasRole(
            1,
            Roles.MODIFY,
            await user1.getAddress()
          ),
          false
        );
      });
    });

    describe('when a non-authorized user attempts to grant roles', async () => {
      it('reverts', async () => {
        await assertRevert(
          systems()
            .Core.connect(user2)
            .grantRole(1, Roles.STAKE, await user2.getAddress()),
          `RoleNotAuthorized("1", "${Roles.MODIFY}", "${await user2.getAddress()}")`,
          systems().Core
        );
      });
    });

    describe('when a role is granted by the owner', function () {
      before('grant the role', async function () {
        const tx = await systems()
          .Core.connect(user1)
          .grantRole(1, Roles.STAKE, await user2.getAddress());
        receipt = await tx.wait();
      });

      it('shows that the role is granted', async function () {
        assert.equal(
          await systems().Core.hasRole(
            1,
            Roles.STAKE,
            await user2.getAddress()
          ),
          true
        );
      });

      it('emits a RoleGranted event', async function () {
        const event = findEvent({ receipt, eventName: 'RoleGranted' });

        assertBn.equal(event.args.accountId, 1);
        assert.equal(event.args.role, Roles.STAKE);
        assert.equal(event.args.target, await user2.getAddress());
        assert.equal(event.args.sender, await user1.getAddress());
      });

      describe('when attempting to renounce a role that was not granted', async () => {
        it('reverts', async () => {
          await assertRevert(
            systems()
              .Core.connect(user2)
              .renounceRole(
                1,
                Roles.MODIFY,
              ),
            `RoleNotGranted("1", "${Roles.MODIFY}", "${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });

      describe('when a role is renounced', function () {
        before('take snapshot', async function () {
          snapshotId = await takeSnapshot(provider());
        });

        before('renounce the role', async () => {
          const tx = await systems()
            .Core.connect(user2)
            .renounceRole(1, Roles.STAKE);
          receipt = await tx.wait();
        });

        after('restore snapshot', async function () {
          await restoreSnapshot(snapshotId, provider());
        });

        it('shows that the role was renounced', async () => {
          assert.equal(
            await systems().Core.hasRole(
              1,
              Roles.STAKE,
              await user2.getAddress()
            ),
            false
          );
        });

        it('emits a RoleRevoked event', async () => {
          const event = findEvent({ receipt, eventName: 'RoleRevoked' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.role, Roles.STAKE);
          assert.equal(event.args.target, await user2.getAddress());
          assert.equal(event.args.sender, await user2.getAddress());
        });
      });

      describe('when a role is revoked', function () {
        before('take snapshot', async function () {
          snapshotId = await takeSnapshot(provider());
        });

        before('revoke the role', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .revokeRole(1, Roles.STAKE, await user2.getAddress());
          receipt = await tx.wait();
        });

        after('restore snapshot', async function () {
          await restoreSnapshot(snapshotId, provider());
        });

        it('shows that the role was revoked', async () => {
          assert.equal(
            await systems().Core.hasRole(
              1,
              Roles.STAKE,
              await user2.getAddress()
            ),
            false
          );
        });

        it('emits a RoleRevoked event', async () => {
          const event = findEvent({ receipt, eventName: 'RoleRevoked' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.role, Roles.STAKE);
          assert.equal(event.args.target, await user2.getAddress());
          assert.equal(event.args.sender, await user1.getAddress());
        });
      });
    });
  });
});
