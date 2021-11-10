const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('BeaconProxy', () => {
  let BeaconProxy, Instance, Beacon, Implementation;

  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  describe('when deploying the proxy and setting implementation A as the first implementation', () => {
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

    before('deploy the proxy and set the beacon', async () => {
      const factory = await ethers.getContractFactory('BeaconProxy');
      BeaconProxy = await factory.deploy(Beacon.address);

      Instance = await ethers.getContractAt('ImplementationMockA', BeaconProxy.address);
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Beacon.getImplementation(), Implementation.address);
    });

    describe('when interacting with implementation A', () => {
      before('set a value', async () => {
        await (await Instance.setA(42)).wait();
      });

      it('can read the value set', async () => {
        assert.equal(await Instance.getA(), 42);
      });
    });

    describe('when triyng to interact with methods that A does not have', () => {
      let BadInstance;

      before('wrap the implementation', async () => {
        BadInstance = await ethers.getContractAt('ImplementationMockB', BeaconProxy.address);
      });

      it('reverts', async () => {
        await assertRevert(BadInstance.getB(), 'function selector was not recognized');
      });
    });

    describe('when upgrading to implementation B', () => {
      before('deploy the implementation', async () => {
        const factory = await ethers.getContractFactory('ImplementationMockB');
        Implementation = await factory.deploy();
      });

      before('upgrade', async () => {
        const tx = await Beacon.upgradeTo(Implementation.address);
        await tx.wait();

        Instance = await ethers.getContractAt('ImplementationMockB', BeaconProxy.address);
      });

      it('shows that the implementation is set', async () => {
        assert.equal(await Beacon.getImplementation(), Implementation.address);
      });

      describe('when interacting with implementation B', () => {
        before('set a value', async () => {
          await (await Instance.setB('hello')).wait();
        });

        it('can read the value previously set', async () => {
          assert.equal(await Instance.getA(), 42);
        });

        it('can read the new value set', async () => {
          assert.equal(await Instance.getB(), 'hello');
        });
      });
    });
  });
});
