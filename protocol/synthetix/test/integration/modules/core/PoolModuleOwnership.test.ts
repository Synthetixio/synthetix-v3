import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';
import { verifyUsesFeatureFlag } from '../../verifications';

describe('PoolModule Create / Ownership', function () {
  const { signers, systems, MockMarket, marketId, poolId, depositAmount } =
    bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  verifyUsesFeatureFlag(
    () => systems().Core,
    'createPool',
    () => systems().Core.connect(user1).createPool(2, ethers.constants.AddressZero)
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
        .createPool(2, await user1.getAddress());
      receipt = await tx.wait();
    });

    it('emitted an event', async () => {
      await assertEvent(
        receipt,
        `PoolCreated(2, "${await user1.getAddress()}", "${await user1.getAddress()}")`,
        systems().Core
      );
    });

    it('is created', async () => {
      assert.equal(await systems().Core.getPoolOwner(2), await user1.getAddress());
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
            .createPool(2, await user1.getAddress()),
          'PoolAlreadyExists("2")',
          systems().Core
        );
      });
    });

    describe('when transferring to a new owner', async () => {
      describe('when attempting to accept before nominating', async () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user2).acceptPoolOwnership(2),
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
            .nominatePoolOwner(await user2.getAddress(), 2);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          await assertEvent(
            receipt,
            `PoolOwnerNominated(2, "${await user2.getAddress()}", "${await user1.getAddress()}")`,
            systems().Core
          );
        });

        it('emits an event when nominee renounces', async () => {
          const tx = await systems().Core.connect(user2).renouncePoolNomination(2);
          receipt = await tx.wait();
          await assertEvent(
            receipt,
            `PoolNominationRenounced(2, "${await user2.getAddress()}")`,
            systems().Core
          );
        });

        it('emits an event owner revoke nominee', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .nominatePoolOwner(await user2.getAddress(), 2);
          await tx.wait();
          const tx2 = await systems().Core.connect(user1).revokePoolNomination(2);
          receipt = await tx2.wait();
          await assertEvent(
            receipt,
            `PoolNominationRevoked(2, "${await user1.getAddress()}")`,
            systems().Core
          );
        });

        describe('when accepting the ownership', async () => {
          before('accept ownership', async () => {
            const tx = await systems()
              .Core.connect(user1)
              .nominatePoolOwner(await user2.getAddress(), 2);
            await tx.wait();
            const tx2 = await systems().Core.connect(user2).acceptPoolOwnership(2);
            receipt = await tx2.wait();
          });

          after('return ownership to user1', async () => {
            await (
              await systems()
                .Core.connect(user2)
                .nominatePoolOwner(await user1.getAddress(), 2)
            ).wait();
            await (await systems().Core.connect(user1).acceptPoolOwnership(2)).wait();
          });

          it('emits an event', async () => {
            await assertEvent(
              receipt,
              `PoolOwnershipAccepted(2, "${await user2.getAddress()}")`,
              systems().Core
            );
          });

          it('is the new owner', async () => {
            assert.equal(await systems().Core.getPoolOwner(2), await user2.getAddress());
          });
        });
      });

      describe('when renouncing the ownership', async () => {
        let receipt: ethers.providers.TransactionReceipt;
        before('nominate the new owner', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .nominatePoolOwner(await user2.getAddress(), 2);
          receipt = await tx.wait();
        });

        before('renounce nomination', async () => {
          const tx = await systems().Core.connect(user2).renouncePoolNomination(2);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          await assertEvent(
            receipt,
            `PoolNominationRenounced(2, "${await user2.getAddress()}")`,
            systems().Core
          );
        });

        it('ownership did not change', async () => {
          assert.equal(await systems().Core.getPoolOwner(2), await user1.getAddress());
        });

        describe('when attempting to accept the nomination after renouncing to it', async () => {
          it('reverts', async () => {
            await assertRevert(
              systems().Core.connect(user2).acceptPoolOwnership(2),
              `Unauthorized("${await user2.getAddress()}")`,
              systems().Core
            );
          });
        });
      });

      describe('when owner renouncing his ownership', async () => {
        it('fails when not the owner tries to renounce it', async () => {
          await assertRevert(
            systems().Core.connect(user2).renouncePoolOwnership(2),
            `Unauthorized("${await user2.getAddress()}")`,
            systems().Core
          );
        });
        it('emits and event', async () => {
          await assertEvent(
            await systems().Core.connect(user1).renouncePoolOwnership(2),
            `PoolOwnershipRenounced(2, "${await user1.getAddress()}")`,
            systems().Core
          );
        });
        it('pool has no owner', async () => {
          assert.equal(await systems().Core.getPoolOwner(2), ethers.constants.AddressZero);
        });
      });
    });
  });

  describe('rebalancePool()', () => {
    let initialMarketCapacity: ethers.BigNumber;
    before('save market capacity', async () => {
      initialMarketCapacity = await systems().Core.Market_get_creditCapacityD18(marketId());
    });
    describe('market debt goes up', async () => {
      before('increase market debt and rebalances the markets inside of pool', async () => {
        await MockMarket().connect(owner).setReportedDebt(depositAmount.div(10));

        await systems().Core.connect(owner).Market_distributeDebtToPools(poolId, 999999999);
      });

      it('the ultimate capacity of the market ends up to be the same', async () => {
        assertBn.equal(
          await systems().Core.Market_get_creditCapacityD18(marketId()),
          initialMarketCapacity
        );
      });
    });
  });
});
