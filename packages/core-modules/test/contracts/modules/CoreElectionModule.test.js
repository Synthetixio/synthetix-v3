const { deepEqual, equal, notEqual } = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

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

  describe('when configuring the current epoch', () => {
    it('reverts when a regular user tries to setSeatCount', async () => {
      await assertRevert(CoreElectionModule.connect(user).setSeatCount(5), 'Unauthorized');
    });

    it('allows the owner to setSeatCount', async () => {
      await (await CoreElectionModule.connect(owner).setSeatCount(5)).wait();
    });

    it('reverts when a regular user tries to setEpochDuration', async () => {
      await assertRevert(CoreElectionModule.connect(user).setEpochDuration(10000), 'Unauthorized');
    });

    it('allows the owner to setEpochDuration', async () => {
      await (await CoreElectionModule.connect(owner).setEpochDuration(10000)).wait();
    });

    it('reverts when a regular user tries to setPeriodPercent', async () => {
      await assertRevert(CoreElectionModule.connect(user).setPeriodPercent(20), 'Unauthorized');
    });

    it('reverts when giving an invalid percent value to setPeriodPercent', async () => {
      await assertRevert(CoreElectionModule.connect(owner).setPeriodPercent(101), 'NumberTooBig');
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
        'NumberTooBig'
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
});
