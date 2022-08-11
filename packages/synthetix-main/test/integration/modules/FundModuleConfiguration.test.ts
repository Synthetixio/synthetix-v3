import hre from 'hardhat';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-js/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-js/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-js/utils/ethers/events';
import { bootstrap } from '../bootstrap';
import { ethers } from 'ethers';

describe('FundModule Configuration (SCCP)', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer, user1: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  before('Create some Funds', async () => {
    await (await systems().Core.connect(user1).createFund(1, await user1.getAddress())).wait();
    await (await systems().Core.connect(user1).createFund(2, await user1.getAddress())).wait();
    await (await systems().Core.connect(user1).createFund(3, await user1.getAddress())).wait();
    await (await systems().Core.connect(user1).createFund(4, await user1.getAddress())).wait();
  });

  it('created the funds', async () => {
    console.log(await systems().Core.ownerOf(1));
    assert.equal(await systems().Core.ownerOf(1), await user1.getAddress());
    assert.equal(await systems().Core.ownerOf(2), await user1.getAddress());
    assert.equal(await systems().Core.ownerOf(3), await user1.getAddress());
    assert.equal(await systems().Core.ownerOf(4), await user1.getAddress());
  });

  it('does not have any approved or prefered fund at creation time', async () => {
    assertBn.equal(await systems().Core.getPreferredFund(), 0);

    assert.equal((await systems().Core.getApprovedFunds()).length, 0);
  });

  describe('when attempting to set a preferred fund as a regular user', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(user1).setPreferredFund(1),
        `Unauthorized("${await user1.getAddress()}")`,
        systems().Core
      );
    });
  });

  describe('when attempting to add an approved fund as a regular user', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(user1).addApprovedFund(1),
        `Unauthorized("${await user1.getAddress()}")`,
        systems().Core
      );
    });
  });

  describe('when attempting to remove an approved fund as a regular user', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(user1).removeApprovedFund(1),
        `Unauthorized("${await user1.getAddress()}")`,
        systems().Core
      );
    });
  });

  describe('when attempting to set a preferred fund that does not exist', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(owner).setPreferredFund(5),
        'FundNotFound("5")',
        systems().Core
      );
    });
  });

  describe('when attempting to add an approved fund that does not exists', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(owner).addApprovedFund(5),
        'FundNotFound("5")',
        systems().Core
      );
    });
  });

  describe('when attempting to remove an approved fund that does not exists', async () => {
    it('reverts', async () => {
      await assertRevert(
        systems().Core.connect(owner).addApprovedFund(5),
        'FundNotFound("5")',
        systems().Core
      );
    });
  });

  describe('when setting the preferred fund', async () => {
    let receipt: ethers.providers.TransactionReceipt;

    before('set the preferred fund', async () => {
      const tx = await systems().Core.connect(owner).setPreferredFund(2);
      receipt = await tx.wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'PreferredFundSet' });

      assertBn.equal(event.args.fundId, 2);
    });

    it('is set', async () => {
      assertBn.equal(await systems().Core.getPreferredFund(), 2);
    });
  });

  describe('when approving funds', async () => {
    let receipt: ethers.providers.TransactionReceipt;

    before('add an approved fund', async () => {
      const tx = await systems().Core.connect(owner).addApprovedFund(3);
      receipt = await tx.wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'FundApprovedAdded' });

      assertBn.equal(event.args.fundId, 3);
    });

    it('is added', async () => {
      const approvedFunds = (await systems().Core.getApprovedFunds()).map((e: ethers.BigNumber) =>
        e.toString()
      );

      assert.equal(approvedFunds.length, 1);

      assert.equal(approvedFunds.includes('3'), true);
    });

    describe('when attempting to add an approved fund that is already in the list', async () => {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(owner).addApprovedFund(3),
          'FundAlreadyApproved("3")',
          systems().Core
        );
      });
    });

    describe('when removing approved funds', async () => {
      before('add other approved fund', async () => {
        const tx = await systems().Core.connect(owner).addApprovedFund(4);
        receipt = await tx.wait();
      });

      it('is added', async () => {
        const approvedFunds = (await systems().Core.getApprovedFunds()).map((e: ethers.BigNumber) =>
          e.toString()
        );

        assert.equal(approvedFunds.length, 2);

        assert.equal(approvedFunds.includes('3'), true);
        assert.equal(approvedFunds.includes('4'), true);
      });

      describe('when attempting to remove an approved fund that is not in the list', async () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(owner).removeApprovedFund(1),
            'FundNotFound("1")',
            systems().Core
          );
        });
      });

      describe('when removing fund from approved list', async () => {
        before('remove an approved fund', async () => {
          const tx = await systems().Core.connect(owner).removeApprovedFund(3);
          receipt = await tx.wait();
        });

        it('emmited an event', async () => {
          const event = findEvent({ receipt, eventName: 'FundApprovedRemoved' });

          assertBn.equal(event.args.fundId, 3);
        });

        it('is removed', async () => {
          const approvedFunds = (await systems().Core.getApprovedFunds()).map((e: ethers.BigNumber) =>
            e.toString()
          );

          assert.equal(approvedFunds.length, 1);

          assert.equal(approvedFunds.includes('3'), false);
          assert.equal(approvedFunds.includes('4'), true);
        });
      });
    });
  });
});
