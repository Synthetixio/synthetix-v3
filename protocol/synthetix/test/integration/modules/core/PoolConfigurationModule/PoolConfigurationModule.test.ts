import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers as Ethers } from 'ethers';

import { bootstrap } from '../../../bootstrap';

describe('PoolConfigurationModule', function () {
  const { signers, systems } = bootstrap();

  let owner: Ethers.Signer, user1: Ethers.Signer, user2: Ethers.Signer;

  let receipt: Ethers.providers.TransactionReceipt;

  async function createPool(poolId: number, creator: Ethers.Signer) {
    await (
      await systems()
        .Core.connect(creator)
        .createPool(poolId, await creator.getAddress())
    ).wait();
  }

  describe('PoolConfigurationModule', function () {
    before('identify signers', async () => {
      [owner, user1, user2] = signers();
    });

    describe('when some pools are created', function () {
      before('give user1 permission to create pools', async () => {
        await systems()
          .Core.connect(owner)
          .addToFeatureFlagAllowlist(
            Ethers.utils.formatBytes32String('createPool'),
            await user1.getAddress()
          );
      });

      before('create', async () => {
        await createPool(1, user1);
        await createPool(2, user1);
        await createPool(3, user1);
        await createPool(4, user1);
      });

      it('shows that the pools are created and owned by user1', async () => {
        assert.equal(await systems().Core.getPoolOwner(1), await user1.getAddress());
        assert.equal(await systems().Core.getPoolOwner(2), await user1.getAddress());
        assert.equal(await systems().Core.getPoolOwner(3), await user1.getAddress());
        assert.equal(await systems().Core.getPoolOwner(4), await user1.getAddress());
      });

      it('shows that the owner does not have any approved or prefered pools yet', async () => {
        assertBn.equal(await systems().Core.getPreferredPool(), 0);
        assert.equal((await systems().Core.getApprovedPools()).length, 0);
      });

      describe('when regular users attempt to modify preferred or approved pools', function () {
        describe('when attempting to set a preferred pool as a regular user', async () => {
          it('reverts', async () => {
            await assertRevert(
              systems().Core.connect(user1).setPreferredPool(1),
              `Unauthorized("${await user1.getAddress()}")`,
              systems().Core
            );
          });
        });

        describe('when attempting to add an approved pool as a regular user', async () => {
          it('reverts', async () => {
            await assertRevert(
              systems().Core.connect(user1).addApprovedPool(1),
              `Unauthorized("${await user1.getAddress()}")`,
              systems().Core
            );
          });
        });

        describe('when attempting to remove an approved pool as a regular user', async () => {
          it('reverts', async () => {
            await assertRevert(
              systems().Core.connect(user1).removeApprovedPool(1),
              `Unauthorized("${await user1.getAddress()}")`,
              systems().Core
            );
          });
        });
      });

      describe('when the owner modifies preferred or approved pools', function () {
        describe('when the owner attempts to set a preferred pool that does not exist', async () => {
          it('reverts', async () => {
            await assertRevert(
              systems().Core.connect(owner).setPreferredPool(5),
              'PoolNotFound("5")',
              systems().Core
            );
          });
        });

        describe('when the owner sets the preferred pool', async () => {
          before('set the preferred pool', async () => {
            const tx = await systems().Core.connect(owner).setPreferredPool(2);
            receipt = await tx.wait();
          });

          it('emitted an event', async () => {
            await assertEvent(receipt, 'PreferredPoolSet(2)', systems().Core);
          });

          it('reflects the preferred pool', async () => {
            assertBn.equal(await systems().Core.getPreferredPool(), 2);
          });
        });

        describe('when the owner attempts to approve a pool that does not exist', async () => {
          it('reverts', async () => {
            await assertRevert(
              systems().Core.connect(owner).addApprovedPool(5),
              'PoolNotFound("5")',
              systems().Core
            );
          });
        });

        describe('when the owner approves a pool', async () => {
          before('approve pool', async () => {
            const tx = await systems().Core.connect(owner).addApprovedPool(3);
            receipt = await tx.wait();
          });

          it('emitted an event', async () => {
            await assertEvent(receipt, 'PoolApprovedAdded(3)', systems().Core);
          });

          it('shows that the pool is approved', async () => {
            const approvedPools = (await systems().Core.getApprovedPools()).map(
              (e: Ethers.BigNumber) => e.toString()
            );

            assert.equal(approvedPools.length, 1);
            assert.equal(approvedPools.includes('3'), true);
          });

          describe('when the owner attempts to approve a pool that is already approved', async () => {
            it('reverts', async () => {
              await assertRevert(
                systems().Core.connect(owner).addApprovedPool(3),
                'ValueAlreadyInSet()',
                systems().Core
              );
            });
          });

          describe('when attempting to remove a pool that was never approved', async () => {
            it('reverts', async () => {
              await assertRevert(
                systems().Core.connect(owner).addApprovedPool(5),
                'PoolNotFound("5")',
                systems().Core
              );
            });
          });

          describe('when the owner removes an approved pool', async () => {
            before('remove pool', async () => {
              const tx = await systems().Core.connect(owner).removeApprovedPool(3);
              receipt = await tx.wait();
            });

            it('emitted an event', async () => {
              await assertEvent(receipt, 'PoolApprovedRemoved(3)', systems().Core);
            });

            it('shows that the pool is no longer approved', async () => {
              const approvedPools = (await systems().Core.getApprovedPools()).map(
                (e: Ethers.BigNumber) => e.toString()
              );

              assert.equal(approvedPools.length, 0);
              assert.equal(approvedPools.includes('3'), false);
            });
          });
        });
      });

      describe('when the owner tries to disable/enable new collaterals by default', () => {
        it('setPoolCollateralDisabledByDefault is restricted to the pool owner', async () => {
          await assertRevert(
            systems().Core.connect(user2).setPoolCollateralDisabledByDefault(1, true),
            `Unauthorized("${await user2.getAddress()}")`,
            systems().Core
          );
        });

        it('pool owner disables new collaterals by default', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .setPoolCollateralDisabledByDefault(1, true);

          receipt = await tx.wait();
          await assertEvent(receipt, 'PoolCollateralDisabledByDefaultSet(1, true)', systems().Core);
        });
      });
    });
  });
});
