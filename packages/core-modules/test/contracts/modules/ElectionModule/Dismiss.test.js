const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const { ElectionPeriod } = require('./helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { runElection } = require('./helpers/election-helper');
const {
  getTime,
  fastForwardTo,
  takeSnapshot,
  restoreSnapshot,
} = require('@synthetixio/core-js/utils/hardhat/rpc');

describe.only('ElectionModule (dismiss)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let members;

  let owner, user1, user2, user3, user4;

  let ElectionModule, CouncilToken;

  let snapshotId;

  let nominationPeriodStartDate, votingPeriodStartDate, epochEndDate;

  async function itHasExpectedMembers() {
    it('shows that the members are in the council', async function () {
      assert.deepEqual(
        await ElectionModule.getCouncilMembers(),
        members.map((m) => m.address)
      );
    });

    it('shows that all members hold their corresponding NFT', async function () {
      for (let member of members) {
        assertBn.equal(await CouncilToken.balanceOf(member.address), 1);

        const tokenId = members.indexOf(member) + 1;
        assert.equal(await CouncilToken.ownerOf(tokenId), member.address);
      }
    });
  }

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [owner, user1, user2, user3, user4] = users;
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule.initializeElectionModule(
        'Spartan Council Token',
        'SCT',
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate
      );
    });

    before('identify the council token', async function () {
      const tokenAddress = await ElectionModule.getCouncilToken();

      CouncilToken = await ethers.getContractAt('CouncilToken', tokenAddress);
    });

    describe('after some election', function () {
      before('run election', async function () {
        members = [owner, user1, user2];
        await runElection(ElectionModule, members);
      });

      itHasExpectedMembers();
    });

    describe('when a non-owner account attempts to dismiss a council member', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user1).dismissMembers([owner.address]),
          'Unauthorized'
        );
      });
    });

    describe('when the owner attempts to dismiss a non-existing member', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(owner).dismissMembers([user3.address]),
          'NotACouncilMember'
        );
      });
    });

    describe('when the owner dismisses council members, but does not trigger an emergency election', function () {
      before('take snapshot', async function () {
        snapshotId = await takeSnapshot(ethers.provider);
      });

      after('restore snapshot', async function () {
        await restoreSnapshot(snapshotId, ethers.provider);
      });

      before('dismiss', async function () {
        const tx = await ElectionModule.connect(owner).dismissMembers([user2.address]);
        await tx.wait();

        members = [owner, user1];
      });

      itHasExpectedMembers();

      it('shows that the current period is Idle', async function () {
        assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Idle);
      });
    });
  });

  describe('when the owner dismisses council members and triggers and emergency election', function () {
    describe('while in the Idle period', function () {
      before('take snapshot', async function () {
        snapshotId = await takeSnapshot(ethers.provider);
      });

      after('restore snapshot', async function () {
        await restoreSnapshot(snapshotId, ethers.provider);
      });

      before('record schedule', async function () {
        nominationPeriodStartDate = await ElectionModule.getNominationPeriodStartDate();
        votingPeriodStartDate = await ElectionModule.getVotingPeriodStartDate();
        epochEndDate = await ElectionModule.getEpochEndDate();
      });

      before('dismiss', async function () {
        const tx = await ElectionModule.connect(owner).dismissMembers([user1.address, user2.address]);
        await tx.wait();

        members = [owner];
      });

      itHasExpectedMembers();

      it('shows that the current period is Nomination', async function () {
        assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
      });

      it('shows that the schedule has been moved forward', async function () {
        assertBn.gt(nominationPeriodStartDate, await ElectionModule.getNominationPeriodStartDate());
        assertBn.gt(votingPeriodStartDate, await ElectionModule.getVotingPeriodStartDate());
        assertBn.gt(epochEndDate, await ElectionModule.getEpochEndDate());
      });
    });

    describe.skip('while not in the Idle period', function () {
      // TODO
    });
  });
});
