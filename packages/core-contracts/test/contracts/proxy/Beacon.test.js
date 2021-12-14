const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe('Beacon', () => {
  let Beacon, Implementation;

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  describe('when trying to deploy the beacon with an invalid owner', () => {
    it('reverts', async () => {
      const factory = await ethers.getContractFactory('Beacon');
      await assertRevert(
        factory.deploy('0x0000000000000000000000000000000000000000'),
        'ZeroAddress()'
      );
    });
  });

  describe('when deploying the beacon with valid parameters', () => {
    before('deploy the beacon', async () => {
      const factory = await ethers.getContractFactory('Beacon');
      Beacon = await factory.deploy(owner.address);
    });

    before('deploy the implementation', async () => {
      const factory = await ethers.getContractFactory('ImplementationMockA');
      Implementation = await factory.deploy();
    });

    before('set the beacons first implementation', async () => {
      const tx = await Beacon.upgradeTo(Implementation.address);
      await tx.wait();
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Beacon.getImplementation(), Implementation.address);
    });

    describe('when trying to upgrade to an EOA', () => {
      it('reverts', async () => {
        await assertRevert(Beacon.upgradeTo(user.address), `NotAContract("${user.address}")`);
      });
    });

    describe('when trying to upgrade to the zero address', () => {
      it('reverts', async () => {
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        await assertRevert(Beacon.upgradeTo(zeroAddress), 'ZeroAddress');
      });
    });

    describe('when trying to upgrade to the same address', () => {
      it('reverts', async () => {
        await assertRevert(Beacon.upgradeTo(Implementation.address), 'NoChange()');
      });
    });

    describe('when upgrading to a new implementation', () => {
      before('deploy the new implementation', async () => {
        const factory = await ethers.getContractFactory('ImplementationMockB');
        Implementation = await factory.deploy();
      });

      describe('when a non-owner tries to upgrade', () => {
        it('reverts', async () => {
          await assertRevert(Beacon.connect(user).upgradeTo(user.address), 'Unauthorized');
        });
      });

      describe('when the owner tries to upgrade', () => {
        let upgradeReceipt;

        before('set the new implementation', async () => {
          const tx = await Beacon.connect(owner).upgradeTo(Implementation.address);
          upgradeReceipt = await tx.wait();
        });

        it('shows that the implementation is set', async () => {
          assert.equal(await Beacon.getImplementation(), Implementation.address);
        });

        it('emitted an Upgraded event', async () => {
          const event = findEvent({ receipt: upgradeReceipt, eventName: 'Upgraded' });

          assert.equal(event.args.implementation, Implementation.address);
        });
      });
    });
  });
});
