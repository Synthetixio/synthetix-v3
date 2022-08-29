import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';

import { bootstrap } from '../bootstrap';

describe('PoolModule Create / Ownership', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [, user1, user2] = signers();
  });

  describe('When creating a Pool', async () => {
    let receipt: ethers.providers.TransactionReceipt;

    before('create a pool', async () => {
      const tx = await systems()
        .Core.connect(user1)
        .createPool(1, await user1.getAddress());
      receipt = await tx.wait();
    });

    it('emitted an event', async () => {
      const event = findEvent({ receipt, eventName: 'PoolCreated' });

      assert.equal(event.args.owner, await user1.getAddress());
      assertBn.equal(event.args.poolId, 1);
    });

    it('is created', async () => {
      assert.equal(await systems().Core.ownerOf(1), await user1.getAddress());
    });

    describe('when trying to create the same systems().CoreId', () => {
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
            .nominateNewPoolOwner(await user2.getAddress(), 1);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'NominatedNewOwner' });

          assertBn.equal(event.args.poolId, 1);
          assert.equal(event.args.nominatedOwner, await user2.getAddress());
        });

        describe('when accepting the ownership', async () => {
          before('accept ownership', async () => {
            const tx = await systems().Core.connect(user2).acceptPoolOwnership(1);
            receipt = await tx.wait();
          });

          after('return ownership to user1', async () => {
            await (
              await systems()
                .Core.connect(user2)
                .nominateNewPoolOwner(await user1.getAddress(), 1)
            ).wait();
            await (await systems().Core.connect(user1).acceptPoolOwnership(1)).wait();
          });

          it('emits an event', async () => {
            const event = findEvent({
              receipt,
              eventName: 'OwnershipAccepted',
            });

            assertBn.equal(event.args.poolId, 1);
            assert.equal(event.args.newOwner, await user2.getAddress());
          });

          it('is the new owner', async () => {
            assert.equal(await systems().Core.ownerOf(1), await user2.getAddress());
          });
        });
      });

      describe('when renouncing the ownership', async () => {
        let receipt: ethers.providers.TransactionReceipt;
        before('nominate the new owner', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .nominateNewPoolOwner(await user2.getAddress(), 1);
          receipt = await tx.wait();
        });

        before('renounce nomination', async () => {
          const tx = await systems().Core.connect(user2).renouncePoolNomination(1);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'OwnershipRenounced' });

          assertBn.equal(event.args.poolId, 1);
          assert.equal(event.args.target, await user2.getAddress());
        });

        it('ownership did not change', async () => {
          assert.equal(await systems().Core.ownerOf(1), await user1.getAddress());
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
