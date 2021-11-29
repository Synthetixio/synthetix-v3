const { equal, notEqual } = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

const { ethers } = hre;

describe('CoreElectionModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let CoreElectionModule;
  let user;

  before('identify signers', async () => {
    [, user] = await ethers.getSigners();
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
          'OnlyOwnerAllowed()'
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
      equal(await MemberToken.decimals(), 0);
    });

    describe('when attempting to create the MemberToken twice', () => {
      it('reverts', async () => {
        await assertRevert(
          CoreElectionModule.createMemberToken('Member Token', 'cmt'),
          'MemberTokenAlreadyCreated()'
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
          'OnlyOwnerAllowed()'
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
});
