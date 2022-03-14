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

describe('ElectionModule (dismiss)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let members;

  let owner, user1, user2, user3, user4;

  let ElectionModule, CouncilToken;

  let snapshotId;

  let nominationPeriodStartDate, votingPeriodStartDate, epochEndDate;

  let receipt;

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
        [owner.address],
        1,
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
        await runElection(ElectionModule, owner, members);
      });

      before('configure minimum seat count', async function () {
        await ElectionModule.connect(owner).setMinimumActiveMembers(2);
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
        receipt = await tx.wait();

        members = [owner, user1];
      });

      itHasExpectedMembers();

      it('emitted a CouncilMembersDismissed event', async function () {
        const event = findEvent({ receipt, eventName: 'CouncilMembersDismissed' });

        assert.ok(event);
        assert.deepEqual(event.args.members, [user2.address]);
      });

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
        const tx = await ElectionModule.connect(owner).dismissMembers([
          user1.address,
          user2.address,
        ]);
        receipt = await tx.wait();

        members = [owner];
      });

      itHasExpectedMembers();

      it('emitted a CouncilMembersDismissed event', async function () {
        const event = findEvent({ receipt, eventName: 'CouncilMembersDismissed' });

        assert.ok(event);
        assert.deepEqual(event.args.members, [user1.address, user2.address]);
      });

      it('emitted an EmergencyElectionStarted event', async function () {
        const event = findEvent({ receipt, eventName: 'EmergencyElectionStarted' });

        assert.ok(event);
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
      });

      it('shows that the schedule has been moved forward', async function () {
        assertBn.gt(nominationPeriodStartDate, await ElectionModule.getNominationPeriodStartDate());
        assertBn.gt(votingPeriodStartDate, await ElectionModule.getVotingPeriodStartDate());
        assertBn.gt(epochEndDate, await ElectionModule.getEpochEndDate());
      });

      it('allows candidates to nominate', async function () {
        await ElectionModule.connect(user2).nominate();
        await ElectionModule.connect(user3).nominate();
        await ElectionModule.connect(user4).nominate();
      });
    });

    describe('while in the Nomination period', function () {
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

      before('fast forward to the Nomination period', async function () {
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
      });

      before('dismiss', async function () {
        const tx = await ElectionModule.connect(owner).dismissMembers([
          user1.address,
          user2.address,
        ]);
        receipt = await tx.wait();

        members = [owner];
      });

      itHasExpectedMembers();

      it('emitted a CouncilMembersDismissed event', async function () {
        const event = findEvent({ receipt, eventName: 'CouncilMembersDismissed' });

        assert.ok(event);
        assert.deepEqual(event.args.members, [user1.address, user2.address]);
      });

      it('did not emitted an EmergencyElectionStarted event', async function () {
        const event = findEvent({ receipt, eventName: 'EmergencyElectionStarted' });

        assert.equal(event, undefined);
      });

      it('shows that the schedule has not moved', async function () {
        assertBn.equal(
          nominationPeriodStartDate,
          await ElectionModule.getNominationPeriodStartDate()
        );
        assertBn.equal(votingPeriodStartDate, await ElectionModule.getVotingPeriodStartDate());
        assertBn.equal(epochEndDate, await ElectionModule.getEpochEndDate());
      });

      it('allows candidates to nominate', async function () {
        await ElectionModule.connect(user2).nominate();
        await ElectionModule.connect(user3).nominate();
        await ElectionModule.connect(user4).nominate();
      });
    });

    describe('while in the Voting period', function () {
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

      before('fast forward to the Nomination period and nominate', async function () {
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);

        await ElectionModule.connect(user2).nominate();
        await ElectionModule.connect(user3).nominate();
        await ElectionModule.connect(user4).nominate();
      });

      before('fast forward to the Voting period', async function () {
        await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
      });

      before('dismiss', async function () {
        const tx = await ElectionModule.connect(owner).dismissMembers([
          user1.address,
          user2.address,
        ]);
        receipt = await tx.wait();

        members = [owner];
      });

      itHasExpectedMembers();

      it('emitted a CouncilMembersDismissed event', async function () {
        const event = findEvent({ receipt, eventName: 'CouncilMembersDismissed' });

        assert.ok(event);
        assert.deepEqual(event.args.members, [user1.address, user2.address]);
      });

      it('did not emitted an EmergencyElectionStarted event', async function () {
        const event = findEvent({ receipt, eventName: 'EmergencyElectionStarted' });

        assert.equal(event, undefined);
      });

      it('shows that the schedule has not moved', async function () {
        assertBn.equal(
          nominationPeriodStartDate,
          await ElectionModule.getNominationPeriodStartDate()
        );
        assertBn.equal(votingPeriodStartDate, await ElectionModule.getVotingPeriodStartDate());
        assertBn.equal(epochEndDate, await ElectionModule.getEpochEndDate());
      });

      it('allows users to vote', async function () {
        const candidates = [user2.address, user3.address, user4.address];

        await ElectionModule.connect(user2).elect(candidates);
        await ElectionModule.connect(user3).elect(candidates);
        await ElectionModule.connect(user4).elect(candidates);
      });
    });
  });
});
