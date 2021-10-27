const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('Beacon', () => {
  let Beacon, ERC20Mock1, ERC20Mock2;

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  describe('when a beacon is deployed', () => {
    before('deploy the beacon and implementation', async () => {
      let factory;

      factory = await ethers.getContractFactory('ERC20');
      ERC20Mock1 = await factory.deploy('Random Token 1', 'rnd1', 18);
      ERC20Mock2 = await factory.deploy('Random Token 2', 'rnd2', 18);

      factory = await ethers.getContractFactory('BeaconMock');
      Beacon = await factory.deploy(owner.address, ERC20Mock1.address);
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Beacon.getImplementation(), ERC20Mock1.address);
    });

    describe('when upgrading to a new implementation', async () => {
      let receipt;

      describe('when a non-owner invokes it', async () => {
        it('reverts', async () => {
          await assertRevert(
            Beacon.connect(user).upgradeTo(ERC20Mock2.address),
            'OnlyOwnerAllowed()'
          );
        });
      });
      describe('when the owner invokes it', async () => {
        describe('when upgrading to an invalid implementation', () => {
          it('reverts when attempting to upgrade to an EOA', async () => {
            await assertRevert(
              Beacon.connect(owner).upgradeTo(user.address),
              `InvalidContract("${user.address}")`
            );
          });

          it('reverts when attempting to upgrade to an EOA', async () => {
            const zeroAddress = '0x0000000000000000000000000000000000000000';
            await assertRevert(
              Beacon.connect(owner).upgradeTo(zeroAddress),
              `InvalidAddress("${zeroAddress}")`
            );
          });
        });
        describe('when upgrading to a valid implementation', () => {
          before('upgrade', async () => {
            const tx = await Beacon.upgradeTo(ERC20Mock2.address);
            receipt = await tx.wait();
          });

          it('emits an Upgraded event', async () => {
            const event = findEvent({ receipt, eventName: 'Upgraded' });

            assert.equal(event.args.implementation, ERC20Mock2.address);
          });
        });
      });
    });
  });
});
