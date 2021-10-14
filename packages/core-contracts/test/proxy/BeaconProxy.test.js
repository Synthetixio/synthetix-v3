const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('BeaconProxy', () => {
  let BeaconProxy, ERC20Mock1, ERC20Mock2;

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  describe('when a beacon proxy is deployed', () => {
    before('deploy the proxy and implementation', async () => {
      let factory;

      factory = await ethers.getContractFactory('ERC20');
      ERC20Mock1 = await factory.deploy('Random Token 1', 'rnd1', 18);
      ERC20Mock2 = await factory.deploy('Random Token 2', 'rnd2', 18);

      factory = await ethers.getContractFactory('BeaconMock');
      BeaconProxy = await factory.deploy(owner.address, ERC20Mock1.address);
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await BeaconProxy.getImplementation(), ERC20Mock1.address);
    });

    describe('when upgrading to a new implementation', async () => {
      let receipt;

      describe('when a non-owner invokes it', async () => {
        it('reverts', async () => {
          await assertRevert(
            BeaconProxy.connect(user).upgradeTo(ERC20Mock2.address),
            'Only owner can invoke'
          );
        });
      });
      describe('when the owner invokes it', async () => {
        before('upgrade', async () => {
          const tx = await BeaconProxy.upgradeTo(ERC20Mock2.address);
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
