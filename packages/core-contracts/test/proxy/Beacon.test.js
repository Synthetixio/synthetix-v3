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
    before('deploy the beacon and set an initial implementation', async () => {
      let factory, tx;

      factory = await ethers.getContractFactory('ERC20');
      ERC20Mock1 = await factory.deploy();
      tx = await ERC20Mock1.initialize('Random Token 1', 'rnd1', 18);
      await tx.wait();
      ERC20Mock2 = await factory.deploy();
      tx = await ERC20Mock2.initialize('Random Token 2', 'rnd2', 18);
      await tx.wait();

      factory = await ethers.getContractFactory('BeaconMock');
      Beacon = await factory.deploy();
      // set the implementation via upgradeTo()
      tx = await Beacon.upgradeTo(ERC20Mock1.address);
      await tx.wait();
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Beacon.getImplementation(), ERC20Mock1.address);
    });

    describe('when upgrading to a new implementation', async () => {
      let receipt;

      describe('when upgrading to an invalid implementation', () => {
        it('reverts when attempting to upgrade to the same implementation', async () => {
          await assertRevert(
            Beacon.upgradeTo(ERC20Mock1.address),
            `InvalidImplementation("${ERC20Mock1.address}")`
          );
        });

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
