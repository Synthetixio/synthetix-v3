const { deepEqual, equal, notEqual } = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { fastForward } = require('@synthetixio/core-js/utils/rpc');

const { ethers } = hre;

describe('CoreElectionModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let CoreElectionModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    CoreElectionModule = await ethers.getContractAt('CoreElectionModule', proxyAddress());
  });

  it('no MemberToken is deployed', async () => {
    const address = await CoreElectionModule.getMemberTokenAddress();
    equal(address, '0x0000000000000000000000000000000000000000');
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
    let ERC20;
    before('prepare token', async () => {
      const factory = await ethers.getContractFactory('ERC20');
      ERC20 = await factory.deploy();
    });

    it('reverts when a regular user tries to setElectionTokenAddress', async () => {
      await assertRevert(
        CoreElectionModule.connect(user).setElectionTokenAddress(
          '0x0000000000000000000000000000000000000000'
        ),
        'Unauthorized'
      );
    });

    it('allows the owner to setElectionTokenAddress', async () => {
      await (await CoreElectionModule.connect(owner).setElectionTokenAddress(ERC20.address)).wait();
    });
  });

  describe('when configuring the current epoch', () => {
    it('reverts when a regular user tries to setSeatCount', async () => {
      await assertRevert(CoreElectionModule.connect(user).setSeatCount(5), 'Unauthorized');
    });

    it('allows the owner to setSeatCount', async () => {
      await (await CoreElectionModule.connect(owner).setSeatCount(5)).wait();
    });

    it('reverts when a regular user tries to setPeriodPercent', async () => {
      await assertRevert(CoreElectionModule.connect(user).setPeriodPercent(20), 'Unauthorized');
    });

    it('reverts when giving an invalid percent value to setPeriodPercent', async () => {
      await assertRevert(
        CoreElectionModule.connect(owner).setPeriodPercent(101),
        'InvalidPeriodPercent'
      );
    });

    it('allows the owner to setPeriodPercent', async () => {
      await (await CoreElectionModule.connect(owner).setPeriodPercent(20)).wait();
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

  describe('when electing a new council', () => {
    let candidates;

    before('identify candidates', async () => {
      // Grab 5 users as candidates
      candidates = (await ethers.getSigners()).slice(2, 7);
    });

    before('prepare next epoch', async () => {
      // Next seat count should be 3, and leave 2 outside
      await (await CoreElectionModule.connect(owner).setNextSeatCount(3)).wait();
    });

    before('nominate candidates', async () => {
      await Promise.all(
        candidates.map((candidate) => CoreElectionModule.connect(candidate).nominate())
      );
    });

    it('reverts when trying to elect an invalid amount of candidates', async () => {
      await assertRevert(
        CoreElectionModule.connect(user).elect([candidates[0].address, candidates[1].address]),
        'InvalidCandidatesCount'
      );
    });
  });

  describe('when checking epoch states', () => {
    describe('before starting an epoch', () => {
      it('checking if epoch finished returns false', async () => {
        equal(await CoreElectionModule.isEpochFinished(), false);
      });

      it('checking if epoch nomination period returns false', async () => {
        equal(await CoreElectionModule.isNominating(), false);
      });

      it('checking if epoch fvoting period returns false', async () => {
        equal(await CoreElectionModule.isVoting(), false);
      });
    });

    describe('when the epoch started', () => {
      const minute = 60 * 1000;
      const day = 24 * 60 * minute;
      const week = 7 * day;

      const checkTimeState = async ({
        timeLapse,
        epochState,
        nominationPeriodState,
        votePeriodState,
      }) => {
        before(`fastForward a ${timeLapse / 1000} seconds`, async () => {
          await fastForward(timeLapse, ethers.provider);
        });

        it('show the right epoch state', async () => {
          equal(await CoreElectionModule.isEpochFinished(), epochState);
        });

        it('show the right nomination period state', async () => {
          equal(await CoreElectionModule.isNominating(), nominationPeriodState);
        });

        it('show the right voting period state', async () => {
          equal(await CoreElectionModule.isVoting(), votePeriodState);
        });
      };

      before('set the nextEpoch parameters', async () => {
        await (await CoreElectionModule.connect(owner).setNextEpochDuration(week)).wait();
        await (await CoreElectionModule.connect(owner).setNextPeriodPercent(15)).wait(); // 15% ~1 day
      });

      before('start epoch', async () => {
        await (await CoreElectionModule.setupFirstEpoch()).wait();
      });

      checkTimeState({
        timeLapse: minute * 2,
        epochState: false,
        nominationPeriodState: true,
        votePeriodState: false,
      });

      describe('when the nomination period finished', () => {
        checkTimeState({
          timeLapse: day * 2,
          epochState: false,
          nominationPeriodState: false,
          votePeriodState: true,
        });
      });

      describe('when the epoch finished', () => {
        checkTimeState({
          timeLapse: week,
          epochState: true,
          nominationPeriodState: false,
          votePeriodState: false,
        });
      });

      describe('when attempting to set the first epoch again', () => {
        it('reverts', async () => {
          await assertRevert(CoreElectionModule.setupFirstEpoch(), 'FirstEpochAlreadySetUp');
        });
      });
    });
  });
});
