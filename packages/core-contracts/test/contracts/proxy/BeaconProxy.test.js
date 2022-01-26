const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

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
      const factory = await ethers.getContractFactory('BeaconProxyMock');
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
        assertBn.equal(await Instance.getA(), 42);
      });
    });

    describe('when trying to interact with methods that A does not have', () => {
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
        it('can read the value previously set', async () => {
          assertBn.equal(await Instance.getA(), 42);
        });

        it('can set & read a new value set on A', async () => {
          await (await Instance.setA(64)).wait();
          assertBn.equal(await Instance.getA(), 64);
        });

        it('can set & read a new value set on B', async () => {
          await (await Instance.setB('hello')).wait();
          assert.equal(await Instance.getB(), 'hello');
        });
      });
    });

    describe('when setting a new beacon', () => {
      describe('when trying to set it to an  EOA', () => {
        it('reverts', async () => {
          await assertRevert(
            BeaconProxy.setBeacon(owner.address),
            `NotAContract("${owner.address}")`
          );
        });
      });

      describe('when trying to set it to the zero address', () => {
        it('reverts', async () => {
          const zeroAddress = '0x0000000000000000000000000000000000000000';
          await assertRevert(BeaconProxy.setBeacon(zeroAddress), 'ZeroAddress');
        });
      });

      describe('when trying to set it to the same beacon', () => {
        it('reverts', async () => {
          await assertRevert(BeaconProxy.setBeacon(Beacon.address), 'NoChange');
        });
      });

      describe('when setting it to a valid contract', () => {
        let NewBeacon, receipt;

        before('deploy a new beacon', async () => {
          const factory = await ethers.getContractFactory('Beacon');
          NewBeacon = await factory.deploy(owner.address);
          receipt = await (await BeaconProxy.setBeacon(NewBeacon.address)).wait();
        });

        it('shows that the beacon is set', async () => {
          assert.equal(await BeaconProxy.getBeacon(), NewBeacon.address);
        });

        it('emits an Upgraded event', async () => {
          const event = findEvent({ receipt, eventName: 'BeaconSet' });
          assert.equal(event.args.beacon, NewBeacon.address);
        });
      });
    });
  });
});
