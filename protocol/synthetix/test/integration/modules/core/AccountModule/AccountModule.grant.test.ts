import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { restoreSnapshot, takeSnapshot } from '@synthetixio/core-utils/utils/hardhat/rpc';

import Permissions from '../../../mixins/AccountRBACMixin.permissions';
import { bootstrap } from '../../../bootstrap';

describe('AccountModule', function () {
  const { signers, systems, provider } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;
  let user3: ethers.Signer;

  let receipt: ethers.providers.TransactionReceipt;

  let snapshotId: string;

  describe('AccountModule - Granting, revoking, and renouncing permissions', function () {
    before('identify signers', async () => {
      [, user1, user2, user3] = signers();
    });

    before('create the account', async function () {
      const tx = await systems().Core.connect(user1)['createAccount(uint128)'](1);
      receipt = await tx.wait();
    });

    describe('before permissions have been granted', function () {
      it('shows that certain permissions have not been granted', async () => {
        assert.equal(
          await systems().Core.hasPermission(1, Permissions.WITHDRAW, await user2.getAddress()),
          false
        );
        assert.equal(
          await systems().Core.hasPermission(1, Permissions.ADMIN, await user2.getAddress()),
          false
        );
      });
      it('shows that the owner is authorized', async function () {
        assert.equal(
          await systems().Core.isAuthorized(1, Permissions.ADMIN, await user1.getAddress()),
          true
        );
      });
      it('shows that the other user not authorized', async function () {
        assert.equal(
          await systems().Core.isAuthorized(1, Permissions.ADMIN, await user2.getAddress()),
          false
        );
        assert.equal(
          await systems().Core.isAuthorized(1, Permissions.WITHDRAW, await user2.getAddress()),
          false
        );
      });
    });

    describe('when a non-authorized user attempts to grant permissions', async () => {
      it('reverts', async () => {
        await assertRevert(
          systems()
            .Core.connect(user2)
            .grantPermission(1, Permissions.WITHDRAW, await user2.getAddress()),
          `PermissionDenied("1", "${Permissions.ADMIN}", "${await user2.getAddress()}")`,
          systems().Core
        );
      });
    });

    describe('when a an authorized user attempts to grant an invalid permission', async () => {
      it('reverts', async () => {
        const invalidPermission = ethers.utils.formatBytes32String('INVALID');
        await assertRevert(
          systems()
            .Core.connect(user1)
            .grantPermission(1, invalidPermission, await user2.getAddress()),
          `InvalidPermission("${invalidPermission}")`,
          systems().Core
        );
      });
    });

    describe('when a permission is granted by the owner', function () {
      before('grant the permission', async function () {
        const tx = await systems()
          .Core.connect(user1)
          .grantPermission(1, Permissions.WITHDRAW, await user2.getAddress());
        receipt = await tx.wait();
      });

      it('shows that the permission is granted', async function () {
        assert.equal(
          await systems().Core.hasPermission(1, Permissions.WITHDRAW, await user2.getAddress()),
          true
        );
      });

      it('emits a PermissionGranted event', async function () {
        const event = findSingleEvent({
          receipt,
          eventName: 'PermissionGranted',
        });

        assertBn.equal(event.args.accountId, 1);
        assert.equal(event.args.permission, Permissions.WITHDRAW);
        assert.equal(event.args.user, await user2.getAddress());
        assert.equal(event.args.sender, await user1.getAddress());
      });

      describe('when attempting to renounce a permission that was not granted', async () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user2).renouncePermission(1, Permissions.ADMIN),
            `PermissionNotGranted("1", "${Permissions.ADMIN}", "${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });

      describe('when a permission is renounced', function () {
        before('take snapshot', async function () {
          snapshotId = await takeSnapshot(provider());
        });

        before('renounce the permission', async () => {
          const tx = await systems()
            .Core.connect(user2)
            .renouncePermission(1, Permissions.WITHDRAW);
          receipt = await tx.wait();
        });

        after('restore snapshot', async function () {
          await restoreSnapshot(snapshotId, provider());
        });

        it('shows that the permission was renounced', async () => {
          assert.equal(
            await systems().Core.hasPermission(1, Permissions.WITHDRAW, await user2.getAddress()),
            false
          );
        });

        it('emits a PermissionRevoked event', async () => {
          const event = findSingleEvent({ receipt, eventName: 'PermissionRevoked' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.permission, Permissions.WITHDRAW);
          assert.equal(event.args.user, await user2.getAddress());
          assert.equal(event.args.sender, await user2.getAddress());
        });
      });

      describe('when a permission is revoked', function () {
        before('take snapshot', async function () {
          snapshotId = await takeSnapshot(provider());
        });

        before('revoke the permission', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .revokePermission(1, Permissions.WITHDRAW, await user2.getAddress());
          receipt = await tx.wait();
        });

        after('restore snapshot', async function () {
          await restoreSnapshot(snapshotId, provider());
        });

        it('shows that the permission was revoked', async () => {
          assert.equal(
            await systems().Core.hasPermission(1, Permissions.WITHDRAW, await user2.getAddress()),
            false
          );
        });

        it('emits a PermissionRevoked event', async () => {
          const event = findSingleEvent({ receipt, eventName: 'PermissionRevoked' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.permission, Permissions.WITHDRAW);
          assert.equal(event.args.user, await user2.getAddress());
          assert.equal(event.args.sender, await user1.getAddress());
        });
      });
    });

    describe('when an Admin permission is granted by the owner', function () {
      before('owner grants the admin permission', async function () {
        const tx = await systems()
          .Core.connect(user1)
          .grantPermission(1, Permissions.ADMIN, await user2.getAddress());
        receipt = await tx.wait();
      });

      it('shows that the admin permission is granted by the owner', async function () {
        assert.equal(
          await systems().Core.hasPermission(1, Permissions.ADMIN, await user2.getAddress()),
          true
        );
      });

      it('shows that the admin is authorized to all permissions', async function () {
        assert.equal(
          await systems().Core.isAuthorized(1, Permissions.ADMIN, await user2.getAddress()),
          true
        );
        assert.equal(
          await systems().Core.isAuthorized(1, Permissions.DELEGATE, await user2.getAddress()),
          true
        );
        assert.equal(
          await systems().Core.isAuthorized(1, Permissions.MINT, await user2.getAddress()),
          true
        );
        assert.equal(
          await systems().Core.isAuthorized(1, Permissions.WITHDRAW, await user2.getAddress()),
          true
        );
      });

      describe('admin is able to grant permission', async () => {
        before('admin grants a permission', async function () {
          const tx = await systems()
            .Core.connect(user2)
            .grantPermission(1, Permissions.WITHDRAW, await user3.getAddress());
          receipt = await tx.wait();
        });

        it('shows that the permission is granted', async function () {
          assert.equal(
            await systems().Core.hasPermission(1, Permissions.WITHDRAW, await user3.getAddress()),
            true
          );
        });
      });

      describe('admin is able to revoke a permission', async () => {
        before('grant permission', async function () {
          const tx = await systems()
            .Core.connect(user1)
            .grantPermission(1, Permissions.ADMIN, await user3.getAddress());
          receipt = await tx.wait();
        });

        it('shows that the admin can revoke the permission', async function () {
          const tx = await systems()
            .Core.connect(user2)
            .revokePermission(1, Permissions.ADMIN, await user3.getAddress());
          receipt = await tx.wait();

          assert.equal(
            await systems().Core.hasPermission(1, Permissions.ADMIN, await user3.getAddress()),
            false
          );
        });
      });
    });
  });
});
