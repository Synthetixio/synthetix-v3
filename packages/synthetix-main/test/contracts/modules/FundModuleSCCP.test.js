const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('FundModule - SCCP', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1;

  let FundModule, FundSCCP;

  before('identify signers', async () => {
    [owner, user1] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    FundModule = await ethers.getContractAt('FundModule', proxyAddress());
    FundSCCP = await ethers.getContractAt('FundSCCP', proxyAddress());
  });

  before('Create some Funds', async () => {
    await (await FundModule.connect(user1).createFund(1, user1.address)).wait();
    await (await FundModule.connect(user1).createFund(2, user1.address)).wait();
    await (await FundModule.connect(user1).createFund(3, user1.address)).wait();
    await (await FundModule.connect(user1).createFund(4, user1.address)).wait();
  });

  it('created the funds', async () => {
    console.log(await FundModule.ownerOf(1));
    assert.equal(await FundModule.ownerOf(1), user1.address);
    assert.equal(await FundModule.ownerOf(2), user1.address);
    assert.equal(await FundModule.ownerOf(3), user1.address);
    assert.equal(await FundModule.ownerOf(4), user1.address);
  });

  it('does not have any approved or prefered fund at creation time', async () => {
    assertBn.equal(await FundSCCP.getPreferredFund(), 0);

    assert.equal((await FundSCCP.getApprovedFunds()).length, 0);
  });

  describe('when attempting to set a preferred fund as a regular user', async () => {
    it('reverts', async () => {
      await assertRevert(
        FundSCCP.connect(user1).setPreferredFund(1),
        `Unauthorized("${user1.address}")`
      );
    });
  });

  describe('when attempting to add an approved fund as a regular user', async () => {
    it('reverts', async () => {
      await assertRevert(
        FundSCCP.connect(user1).addApprovedFund(1),
        `Unauthorized("${user1.address}")`
      );
    });
  });

  describe('when attempting to remove an approved fund as a regular user', async () => {
    it('reverts', async () => {
      await assertRevert(
        FundSCCP.connect(user1).removeApprovedFund(1),
        `Unauthorized("${user1.address}")`
      );
    });
  });

  describe('when attempting to set a preferred fund that does not exist', async () => {
    it('reverts', async () => {
      await assertRevert(FundSCCP.connect(owner).setPreferredFund(5), 'FundNotFound(5)');
    });
  });

  describe('when attempting to add an approved fund that does not exists', async () => {
    it('reverts', async () => {
      await assertRevert(FundSCCP.connect(owner).addApprovedFund(5), 'FundNotFound(5)');
    });
  });

  describe('when attempting to remove an approved fund that does not exists', async () => {
    it('reverts', async () => {
      await assertRevert(FundSCCP.connect(owner).addApprovedFund(5), 'FundNotFound(5)');
    });
  });

  describe('when setting the preferred fund', async () => {
    let receipt;

    before('set the preferred fund', async () => {
      const tx = await FundSCCP.connect(owner).setPreferredFund(2);
      receipt = await tx.wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'PreferredFundSet' });

      assertBn.equal(event.args.fundId, 2);
    });

    it('is set', async () => {
      assertBn.equal(await FundSCCP.getPreferredFund(), 2);
    });
  });

  describe('when approving funds', async () => {
    let receipt;

    before('add an approved fund', async () => {
      const tx = await FundSCCP.connect(owner).addApprovedFund(3);
      receipt = await tx.wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'FundApprovedAdded' });

      assertBn.equal(event.args.fundId, 3);
    });

    it('is added', async () => {
      const approvedFunds = (await FundSCCP.getApprovedFunds()).map((e) => e.toString());

      assert.equal(approvedFunds.length, 1);

      assert.equal(approvedFunds.includes('3'), true);
    });

    describe('when attempting to add an approved fund that is already in the list', async () => {
      it('reverts', async () => {
        await assertRevert(FundSCCP.connect(owner).addApprovedFund(3), 'FundAlreadyApproved(3)');
      });
    });

    describe('when removing approved funds', async () => {
      before('add other approved fund', async () => {
        const tx = await FundSCCP.connect(owner).addApprovedFund(4);
        receipt = await tx.wait();
      });

      it('is added', async () => {
        const approvedFunds = (await FundSCCP.getApprovedFunds()).map((e) => e.toString());

        assert.equal(approvedFunds.length, 2);

        assert.equal(approvedFunds.includes('3'), true);
        assert.equal(approvedFunds.includes('4'), true);
      });

      describe('when attempting to remove an approved fund that is not in the list', async () => {
        it('reverts', async () => {
          await assertRevert(FundSCCP.connect(owner).removeApprovedFund(1), 'FundNotFound(1)');
        });
      });

      describe('when removing fund from approved list', async () => {
        before('remove an approved fund', async () => {
          const tx = await FundSCCP.connect(owner).removeApprovedFund(3);
          receipt = await tx.wait();
        });

        it('emmited an event', async () => {
          const event = findEvent({ receipt, eventName: 'FundApprovedRemoved' });

          assertBn.equal(event.args.fundId, 3);
        });

        it('is removed', async () => {
          const approvedFunds = (await FundSCCP.getApprovedFunds()).map((e) => e.toString());

          assert.equal(approvedFunds.length, 1);

          assert.equal(approvedFunds.includes('3'), false);
          assert.equal(approvedFunds.includes('4'), true);
        });
      });
    });
  });
});
