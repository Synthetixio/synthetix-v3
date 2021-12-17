const { deepEqual, equal, notEqual } = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const initializer = require('../../helpers/initializer');
const { fastForward } = require('@synthetixio/core-js/utils/hardhat/rpc');

const { ethers } = hre;

describe('CoreElectionModule Setup, Getters, Setters and Voting', () => {
  const { proxyAddress } = bootstrap(initializer);

  let CoreElectionModule, ElectionStorageMock;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    [CoreElectionModule, ElectionStorageMock] = await Promise.all([
      ethers.getContractAt('CoreElectionModule', proxyAddress()),
      ethers.getContractAt('ElectionStorageMock', proxyAddress()),
    ]);
  });

  describe('when creating MemberToken', () => {
    let memberTokenAddress, MemberToken;

    describe('when a regular user attempts to interact with the protected function', () => {
      it('reverts', async () => {
        await assertRevert(
          CoreElectionModule.connect(user).createMemberToken('Member Token', 'cmt'),
          'Unauthorized'
        );
      });
    });

    before('create a MemberToken', async () => {
      const receipt = await (
        await CoreElectionModule.createMemberToken('Member Token', 'cmt')
      ).wait();
      const evt = findEvent({ receipt, eventName: 'MemberTokenCreated' });

      memberTokenAddress = evt.args.memberTokenAddress;
      MemberToken = await ethers.getContractAt('MemberToken', memberTokenAddress);
    });

    it('emmited an event', async () => {
      notEqual(memberTokenAddress, '0x0000000000000000000000000000000000000000');
    });

    it('gets the newly created address', async () => {
      const address = await CoreElectionModule.getMemberTokenAddress();
      equal(address, memberTokenAddress);
    });

    it('reads the MemberToken parameters', async () => {
      equal(await MemberToken.name(), 'Member Token');
      equal(await MemberToken.symbol(), 'cmt');
    });

    describe('when attempting to create the MemberToken twice', () => {
      it('reverts', async () => {
        await assertRevert(
          CoreElectionModule.createMemberToken('Member Token', 'cmt'),
          'MemberTokenAlreadyCreated'
        );
      });
    });

    describe('when upgrading the MemberToken implementation', () => {
      let NewImplementation;
      before('deploy the new implementation', async () => {
        const factory = await ethers.getContractFactory('MemberToken');
        NewImplementation = await factory.deploy();
      });

      it('reverts when a regular user attempts to upgrade', async () => {
        await assertRevert(
          CoreElectionModule.connect(user).upgradeMemberTokenImplementation(
            NewImplementation.address
          ),
          'Unauthorized'
        );
      });

      it('upgrades to the new implementation', async () => {
        const tx = await CoreElectionModule.upgradeMemberTokenImplementation(
          NewImplementation.address
        );
        await tx.wait();

        equal(await MemberToken.getImplementation(), NewImplementation.address);
      });
    });
  });

  describe('when configuring the election token address', () => {
    let ElectionToken;
    before('prepare token', async () => {
      const factory = await ethers.getContractFactory('ElectionTokenMock');
      ElectionToken = await factory.deploy();
    });

    it('reverts when a regular user tries to setElectionTokenAddress', async () => {
      await assertRevert(
        CoreElectionModule.connect(user).setElectionTokenAddress(
          '0x0000000000000000000000000000000000000000'
        ),
        'Unauthorized'
      );
    });

    describe('when the owner sets the ElectionTokenAddress', () => {
      before('set ElectionTokenAddress', async () => {
        await (
          await CoreElectionModule.connect(owner).setElectionTokenAddress(ElectionToken.address)
        ).wait();
      });

      it('gets the right value', async () => {
        equal(await CoreElectionModule.getElectionTokenAddress(), ElectionToken.address);
      });
    });
  });

  describe('when initializing first epoch', () => {
    describe('before starting the first epoch', () => {
      before('reset epoch', async () => {
        await (await ElectionStorageMock.resetCurrentEpochMock()).wait();
      });

      it('returns false when isNominating', async () => {
        equal(await CoreElectionModule.isNominating(), false);
      });

      it('returns false when isVoting', async () => {
        equal(await CoreElectionModule.isVoting(), false);
      });
    });

    it('reverts when a regular user tries to setupFirstEpoch', async () => {
      await assertRevert(CoreElectionModule.connect(user).setupFirstEpoch(), 'Unauthorized');
    });

    it('sets the first epoch parameters', async () => {
      await (await CoreElectionModule.connect(owner).setupFirstEpoch()).wait();
    });

    it('reverts if already initialized', async () => {
      await assertRevert(
        CoreElectionModule.connect(owner).setupFirstEpoch(),
        'FirstEpochAlreadySet'
      );
    });
  });

  describe('when configuring the next epoch', () => {
    it('reverts when a regular user tries to setNextSeatCount', async () => {
      await assertRevert(CoreElectionModule.connect(user).setNextSeatCount(5), 'Unauthorized');
    });

    it('allows the owner to setNextSeatCount', async () => {
      await (await CoreElectionModule.connect(owner).setNextSeatCount(5)).wait();
    });

    it('reverts when a regular user tries to setNextEpochDuration', async () => {
      await assertRevert(
        CoreElectionModule.connect(user).setNextEpochDuration(10000),
        'Unauthorized'
      );
    });

    it('allows the owner to setNextEpochDuration', async () => {
      await (await CoreElectionModule.connect(owner).setNextEpochDuration(10000)).wait();
    });

    it('reverts when a regular user tries to setNextPeriodPercent', async () => {
      await assertRevert(CoreElectionModule.connect(user).setNextPeriodPercent(20), 'Unauthorized');
    });

    it('reverts when giving an invalid percent value to setNextPeriodPercent', async () => {
      await assertRevert(
        CoreElectionModule.connect(owner).setNextPeriodPercent(101),
        'InvalidPeriodPercent'
      );
    });

    it('allows the owner to setNextPeriodPercent', async () => {
      await (await CoreElectionModule.connect(owner).setNextPeriodPercent(20)).wait();
    });

    it('get the right values', async () => {
      assertBn.eq(await CoreElectionModule.getNextSeatCount(), 5);
      assertBn.eq(await CoreElectionModule.getNextEpochDuration(), 10000);
      assertBn.eq(await CoreElectionModule.getNextPeriodPercent(), 20);
    });

    describe('when swapping epochs', () => {});
  });

  describe('when the address self nominates', () => {
    it('can nominate several addresses', async () => {
      await (await CoreElectionModule.connect(owner).nominate()).wait();
      deepEqual(await CoreElectionModule.getNominees(), [owner.address]);

      await (await CoreElectionModule.connect(user).nominate()).wait();
      deepEqual(await CoreElectionModule.getNominees(), [owner.address, user.address]);
    });

    it('reverts when trying to nominate several times the same address', async () => {
      await assertRevert(CoreElectionModule.connect(owner).nominate(), 'AlreadyNominated');
    });

    it('can withdraw their own nominations', async () => {
      await (await CoreElectionModule.connect(owner).withdrawNomination()).wait();
      deepEqual(await CoreElectionModule.getNominees(), [user.address]);

      await (await CoreElectionModule.connect(user).withdrawNomination()).wait();
      deepEqual(await CoreElectionModule.getNominees(), []);
    });

    it('reverts when withdrawing a not nominated address', async () => {
      await assertRevert(CoreElectionModule.connect(owner).withdrawNomination(), 'NotNominated');
    });
  });

  describe('when voting a new council', () => {
    let ElectionToken, candidates, voters;

    before('identify candidates and voters', async () => {
      // Grab 5 users as candidates and sort by address number
      candidates = (await ethers.getSigners())
        .slice(2, 7)
        .sort((a, b) => Number(a.address) - Number(b.address));
      voters = (await ethers.getSigners()).slice(2, 7);
    });

    before('prepare election token', async () => {
      const factory = await ethers.getContractFactory('ElectionTokenMock');
      ElectionToken = await factory.deploy();
      await (await CoreElectionModule.setElectionTokenAddress(ElectionToken.address)).wait();
    });

    before('assign election tokens to the users', async () => {
      await Promise.all(voters.map((voter) => ElectionToken.connect(voter).mint(100)));
    });

    before('prepare next epoch', async () => {
      // Next seat count should be 3, and leave 2 outside
      await (await ElectionStorageMock.setSeatCountMock(3)).wait();
    });

    before('nominate candidates', async () => {
      await Promise.all(
        candidates.map((candidate) => CoreElectionModule.connect(candidate).nominate())
      );
    });

    it('reverts when trying to elect no candidates', async () => {
      await assertRevert(CoreElectionModule.connect(user).elect([]), 'MissingCandidates');
    });

    it('reverts when trying to elect more candidates than nominees', async () => {
      await assertRevert(
        CoreElectionModule.connect(user).elect(
          [
            user.address,
            owner.address,
            candidates[0].address,
            candidates[1].address,
            candidates[2].address,
            candidates[3].address,
            candidates[4].address,
          ]
        ),
        'TooManyCandidates'
      );
    });

    it('reverts when trying to elect a not nominated candidate', async () => {
      await assertRevert(
        CoreElectionModule.connect(user).elect([user.address]),
        `NotNominated("${user.address}")`
      );
    });

    it('reverts when trying to elect repeated addresses', async () => {
      await assertRevert(
        CoreElectionModule.elect([candidates[0].address, candidates[0].address]),
        `DuplicateCandidates`
      );
    });

    it('allows to elect council members', async () => {
      await CoreElectionModule.connect(voters[1]).elect([candidates[0].address]);
      await CoreElectionModule.connect(voters[2]).elect([candidates[1].address]);
      await CoreElectionModule.connect(voters[3]).elect([candidates[2].address]);
      await CoreElectionModule.connect(voters[4]).elect([candidates[0].address, candidates[2].address]);
    });

    it('correctly saves vote data', async () => {
      deepEqual(await ElectionStorageMock.getVoterVoteCandidatesMock(voters[1].address), [
        candidates[0].address,
      ]);
      deepEqual(await ElectionStorageMock.getVoterVoteCandidatesMock(voters[2].address), [
        candidates[1].address,
      ]);
      deepEqual(await ElectionStorageMock.getVoterVoteCandidatesMock(voters[3].address), [
        candidates[2].address,
      ]);
      deepEqual(await ElectionStorageMock.getVoterVoteCandidatesMock(voters[4].address), [
        candidates[2].address,
        candidates[0].address,
      ]);

      assertBn.eq(await ElectionStorageMock.getVoterVoteVotePowerMock(voters[1].address), 100);
      assertBn.eq(await ElectionStorageMock.getVoterVoteVotePowerMock(voters[2].address), 100);
      assertBn.eq(await ElectionStorageMock.getVoterVoteVotePowerMock(voters[3].address), 100);
      assertBn.eq(await ElectionStorageMock.getVoterVoteVotePowerMock(voters[4].address), 100);
    });

    describe('when casting a vote again', () => {
      before('vote again', async () => {
        await CoreElectionModule.connect(voters[1]).elect([candidates[0].address, candidates[2].address]);
      });

      it('correctly saves vote data', async () => {
        deepEqual(await ElectionStorageMock.getVoterVoteCandidatesMock(voters[1].address), [
          candidates[2].address,
          candidates[0].address,
        ]);

        assertBn.eq(await ElectionStorageMock.getVoterVoteVotePowerMock(voters[1].address), 100);
      });
    });
  });

  describe('when moving in time (epoch state changes)', () => {
    const minute = 60 * 1000;
    const day = 24 * 60 * minute;
    const week = 7 * day;

    const checkTimeState = async ({ timeLapse, epochState, nominatingState, votingState }) => {
      before(`fastForward a ${timeLapse / 1000} seconds`, async () => {
        if (timeLapse > 0) {
          await fastForward(timeLapse, ethers.provider);
        }
      });

      it('show the right state', async () => {
        equal(await CoreElectionModule.isEpochFinished(), epochState, 'wrong epoch state');
        equal(
          await CoreElectionModule.isNominating(),
          nominatingState,
          'wrong nominating period state'
        );
        equal(await CoreElectionModule.isVoting(), votingState, 'wrong voting period state');
      });
    };

    describe('before starting an epoch', () => {
      before('reset epoch', async () => {
        await (await ElectionStorageMock.resetCurrentEpochMock()).wait();
      });

      checkTimeState({
        timeLapse: 0,
        epochState: false,
        nominatingState: false,
        votingState: false,
      });
    });

    describe('when the epoch started', () => {
      before('set current epoch parameters', async () => {
        await (await ElectionStorageMock.setCurrentEpochMock(1, week, 15)).wait();
      });

      checkTimeState({
        timeLapse: minute * 2,
        epochState: false,
        nominatingState: true,
        votingState: false,
      });

      describe('when the nomination period finished', () => {
        checkTimeState({
          timeLapse: day * 2,
          epochState: false,
          nominatingState: false,
          votingState: true,
        });
      });

      describe('when the epoch finished', () => {
        checkTimeState({
          timeLapse: week,
          epochState: true,
          nominatingState: false,
          votingState: false,
        });
      });

      describe('when attempting to set the first epoch again', () => {
        it('reverts', async () => {
          await assertRevert(CoreElectionModule.setupFirstEpoch(), 'FirstEpochAlreadySet');
        });
      });
    });
  });

  describe('when setting up and evaluating an election', () => {
    describe('when attempting to evaluate without setting up a batch size', () => {
      it('shows the batch size', async () => {
        assertBn.eq(await CoreElectionModule.getMaxProcessingBatchSize(), 0);
      });

      it('reverts', async () => {
        await assertRevert(
          CoreElectionModule.connect(user).evaluateElectionBatch(),
          'BatchSizeNotSet'
        );
      });
    });

    describe('when attempting to set the batch size by a not owner', () => {
      it('reverts', async () => {
        await assertRevert(
          CoreElectionModule.connect(user).setMaxProcessingBatchSize(2),
          'Unauthorized'
        );
      });
    });

    describe('when a wrong batch size is setted', () => {
      it('reverts', async () => {
        await assertRevert(
          CoreElectionModule.connect(owner).setMaxProcessingBatchSize(0),
          'InvalidBatchSize'
        );
      });
    });

    describe('when a batch size is setted', () => {
      before('set batch size', async () => {
        await (await CoreElectionModule.connect(owner).setMaxProcessingBatchSize(2)).wait();
      });

      it('shows the batch size', async () => {
        assertBn.eq(await CoreElectionModule.getMaxProcessingBatchSize(), 2);
      });
    });
  });
});
