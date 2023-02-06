import assert from 'assert/strict';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../../bootstrap';
import { verifyUsesFeatureFlag } from '../../verifications';

describe('PoolModule Create / Ownership', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  verifyUsesFeatureFlag(
    () => systems().Core,
    'createPool',
    () => systems().Core.connect(user1).createPool(1, ethers.constants.AddressZero)
  );

  describe('When creating a Pool', async () => {
    let receipt: ethers.providers.TransactionReceipt;

    before('give user1 permission', async () => {
      await systems()
        .Core.connect(owner)
        .addToFeatureFlagAllowlist(
          ethers.utils.formatBytes32String('createPool'),
          user1.getAddress()
        );
    });

    before('create a pool', async () => {
      const tx = await systems()
        .Core.connect(user1)
        .createPool(1, await user1.getAddress());
      receipt = await tx.wait();
    });

    it('emitted an event', async () => {
      await assertEvent(
        receipt,
        `PoolCreated(1, "${await user1.getAddress()}", "${await user1.getAddress()}")`,
        systems().Core
      );
    });

    it('is created', async () => {
      assert.equal(await systems().Core.getPoolOwner(1), await user1.getAddress());
    });

    describe('when trying to create the same systems().CoreId', () => {
      before('give user2 permission', async () => {
        await systems()
          .Core.connect(owner)
          .addToFeatureFlagAllowlist(
            ethers.utils.formatBytes32String('createPool'),
            user2.getAddress()
          );
      });

      it('reverts', async () => {
        await assertRevert(
          systems()
            .Core.connect(user2)
            .createPool(1, await user1.getAddress()),
          'PoolAlreadyExists("1")',
          systems().Core
        );
      });
    });

    describe('when transfering to a new owner', async () => {
      describe('when attempting to accept before nominating', async () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user2).acceptPoolOwnership(1),
            `Unauthorized("${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });

      describe('when nominating a new owner', async () => {
        let receipt: ethers.providers.TransactionReceipt;
        before('', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .nominatePoolOwner(await user2.getAddress(), 1);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          await assertEvent(
            receipt,
            `PoolOwnerNominated(1, "${await user2.getAddress()}", "${await user1.getAddress()}")`,
            systems().Core
          );
        });

        it('emits an event when nominee renounces', async () => {
          const tx = await systems().Core.connect(user2).renouncePoolNomination(1);
          receipt = await tx.wait();
          await assertEvent(
            receipt,
            `PoolNominationRenounced(1, "${await user2.getAddress()}")`,
            systems().Core
          );
        });

        it('emits an event owner revoke nominee', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .nominatePoolOwner(await user2.getAddress(), 1);
          await tx.wait();
          const tx2 = await systems().Core.connect(user1).revokePoolNomination(1);
          receipt = await tx2.wait();
          await assertEvent(
            receipt,
            `PoolNominationRevoked(1, "${await user1.getAddress()}")`,
            systems().Core
          );
        });

        describe('when accepting the ownership', async () => {
          before('accept ownership', async () => {
            const tx = await systems()
              .Core.connect(user1)
              .nominatePoolOwner(await user2.getAddress(), 1);
            await tx.wait();
            const tx2 = await systems().Core.connect(user2).acceptPoolOwnership(1);
            receipt = await tx2.wait();
          });

          after('return ownership to user1', async () => {
            await (
              await systems()
                .Core.connect(user2)
                .nominatePoolOwner(await user1.getAddress(), 1)
            ).wait();
            await (await systems().Core.connect(user1).acceptPoolOwnership(1)).wait();
          });

          it('emits an event', async () => {
            await assertEvent(
              receipt,
              `PoolOwnershipAccepted(1, "${await user2.getAddress()}")`,
              systems().Core
            );
          });

          it('is the new owner', async () => {
            assert.equal(await systems().Core.getPoolOwner(1), await user2.getAddress());
          });
        });
      });

      describe('when renouncing the ownership', async () => {
        let receipt: ethers.providers.TransactionReceipt;
        before('nominate the new owner', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .nominatePoolOwner(await user2.getAddress(), 1);
          receipt = await tx.wait();
        });

        before('renounce nomination', async () => {
          const tx = await systems().Core.connect(user2).renouncePoolNomination(1);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          await assertEvent(
            receipt,
            `PoolNominationRenounced(1, "${await user2.getAddress()}")`,
            systems().Core
          );
        });

        it('ownership did not change', async () => {
          assert.equal(await systems().Core.getPoolOwner(1), await user1.getAddress());
        });

        describe('when attempting to accept the nomination after renouncing to it', async () => {
          it('reverts', async () => {
            await assertRevert(
              systems().Core.connect(user2).acceptPoolOwnership(1),
              `Unauthorized("${await user2.getAddress()}")`,
              systems().Core
            );
          });
        });
      });
    });
  });
});
