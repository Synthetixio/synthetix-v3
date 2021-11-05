const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('Beacon', () => {
  let Beacon, ERC20Mock1, ERC20Mock2;

  let eoa;

  before('identify signers', async () => {
    [eoa] = await ethers.getSigners();
  });

  describe('when a beacon is deployed', () => {
    before('deploy the beacon and implementation', async () => {
      let factory;

      factory = await ethers.getContractFactory('ERC20');
      ERC20Mock1 = await factory.deploy('Random Token 1', 'rnd1', 18);
      ERC20Mock2 = await factory.deploy('Random Token 2', 'rnd2', 18);

      factory = await ethers.getContractFactory('BeaconMock');
      Beacon = await factory.deploy(ERC20Mock1.address);
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Beacon.getImplementation(), ERC20Mock1.address);
    });

    describe('when upgrading to a new implementation', async () => {
      let receipt;

      describe('when upgrading to an invalid implementation', () => {
        it('reverts when attempting to upgrade to an EOA', async () => {
          await assertRevert(Beacon.upgradeTo(eoa.address), `InvalidContract("${eoa.address}")`);
        });

        it('reverts when attempting to upgrade to an EOA', async () => {
          const zeroAddress = '0x0000000000000000000000000000000000000000';
          await assertRevert(Beacon.upgradeTo(zeroAddress), `InvalidAddress("${zeroAddress}")`);
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
