import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';

import { bootstrap } from '../bootstrap';

describe('PoolModule Configuration (SCCP)', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer, user1: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  before('Create some Pools', async () => {
    await (
      await systems()
        .Core.connect(user1)
        .createPool(1, await user1.getAddress())
    ).wait();
    await (
      await systems()
        .Core.connect(user1)
        .createPool(2, await user1.getAddress())
    ).wait();
    await (
      await systems()
        .Core.connect(user1)
        .createPool(3, await user1.getAddress())
    ).wait();
    await (
      await systems()
        .Core.connect(user1)
        .createPool(4, await user1.getAddress())
    ).wait();
  });

  it('created the pools', async () => {
    assert.equal(await systems().Core.ownerOf(1), await user1.getAddress());
    assert.equal(await systems().Core.ownerOf(2), await user1.getAddress());
    assert.equal(await systems().Core.ownerOf(3), await user1.getAddress());
    assert.equal(await systems().Core.ownerOf(4), await user1.getAddress());
  });

  it('does not have any approved or prefered pool at creation time', async () => {
    assertBn.equal(await systems().Core.getPreferredPool(), 0);

    assert.equal((await systems().Core.getApprovedPools()).length, 0);
  });

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

  describe('when attempting to set a preferred pool that does not exist', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(owner).setPreferredPool(5),
        'PoolNotFound("5")',
        systems().Core
      );
    });
  });

  describe('when attempting to add an approved pool that does not exists', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(owner).addApprovedPool(5),
        'PoolNotFound("5")',
        systems().Core
      );
    });
  });

  describe('when attempting to remove an approved pool that does not exists', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(owner).addApprovedPool(5),
        'PoolNotFound("5")',
        systems().Core
      );
    });
  });

  describe('when setting the preferred pool', async () => {
    let receipt: ethers.providers.TransactionReceipt;

    before('set the preferred pool', async () => {
      const tx = await systems().Core.connect(owner).setPreferredPool(2);
      receipt = await tx.wait();
    });

    it('emitted an event', async () => {
      const event = findEvent({ receipt, eventName: 'PreferredPoolSet' });

      assertBn.equal(event.args.poolId, 2);
    });

    it('is set', async () => {
      assertBn.equal(await systems().Core.getPreferredPool(), 2);
    });
  });

  describe('when approving pools', async () => {
    let receipt: ethers.providers.TransactionReceipt;

    before('add an approved pool', async () => {
      const tx = await systems().Core.connect(owner).addApprovedPool(3);
      receipt = await tx.wait();
    });

    it('emitted an event', async () => {
      const event = findEvent({ receipt, eventName: 'PoolApprovedAdded' });

      assertBn.equal(event.args.poolId, 3);
    });

    it('is added', async () => {
      const approvedPools = (await systems().Core.getApprovedPools()).map((e: ethers.BigNumber) =>
        e.toString()
      );

      assert.equal(approvedPools.length, 1);

      assert.equal(approvedPools.includes('3'), true);
    });

    describe('when attempting to add an approved pool that is already in the list', async () => {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(owner).addApprovedPool(3),
          'PoolAlreadyApproved("3")',
          systems().Core
        );
      });
    });

    describe('when removing approved pools', async () => {
      before('add other approved pool', async () => {
        const tx = await systems().Core.connect(owner).addApprovedPool(4);
        receipt = await tx.wait();
      });

      it('is added', async () => {
        const approvedPools = (await systems().Core.getApprovedPools()).map((e: ethers.BigNumber) =>
          e.toString()
        );

        assert.equal(approvedPools.length, 2);

        assert.equal(approvedPools.includes('3'), true);
        assert.equal(approvedPools.includes('4'), true);
      });

      describe('when attempting to remove an approved pool that is not in the list', async () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(owner).removeApprovedPool(1),
            'PoolNotFound("1")',
            systems().Core
          );
        });
      });

      describe('when removing pool from approved list', async () => {
        before('remove an approved pool', async () => {
          const tx = await systems().Core.connect(owner).removeApprovedPool(3);
          receipt = await tx.wait();
        });

        it('emitted an event', async () => {
          const event = findEvent({
            receipt,
            eventName: 'PoolApprovedRemoved',
          });

          assertBn.equal(event.args.poolId, 3);
        });

        it('is removed', async () => {
          const approvedPools = (await systems().Core.getApprovedPools()).map(
            (e: ethers.BigNumber) => e.toString()
          );

          assert.equal(approvedPools.length, 1);

          assert.equal(approvedPools.includes('3'), false);
          assert.equal(approvedPools.includes('4'), true);
        });
      });
    });
  });
});
