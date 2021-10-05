const { ethers } = hre;
const assert = require('assert');
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('UniversalProxy', () => {
  let ForwardingProxy, Instance, Implementation;

  describe('when setting UniversalProxyImplementationMockA as the implementation', () => {
    before('set up proxy and implementation', async () => {
      let factory;

      factory = await ethers.getContractFactory('UniversalProxyImplementationMockA');
      Implementation = await factory.deploy();

      factory = await ethers.getContractFactory('ForwardingProxyMock');
      ForwardingProxy = await factory.deploy(Implementation.address);

      Instance = await ethers.getContractAt(
        'UniversalProxyImplementationMockA',
        ForwardingProxy.address
      );
      console.log(`Original implementation Address: ${Implementation.address}`);
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await ForwardingProxy.getImplementation(), Implementation.address);
    });

    describe('when interacting with the implementation via the proxy', async () => {
      describe('when reading and setting a value that exists in the implementation', () => {
        before('set a value', async () => {
          await (await Instance.setA(42)).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await Instance.getA(), 42);
        });
      });

      describe('when trying to call a function that is not payable', () => {
        it('reverts', async () => {
          await assertRevert(
            Instance.setA(1337, { value: ethers.utils.parseEther('1') }),
            'non-payable method'
          );
        });
      });

      describe('when reading and setting a value that does not exist in the implementation', () => {
        let BadInstance;

        before('wrap the implementation', async () => {
          BadInstance = await ethers.getContractAt(
            'UniversalProxyImplementationMockB',
            ForwardingProxy.address
          );
        });

        it('reverts', async () => {
          await assertRevert(BadInstance.getB(), 'function selector was not recognized');
        });
      });
    });
  });

  describe('when attempts to upgrade to an EOA', () => {
    it('reverts', async () => {
      const [user] = await ethers.getSigners();

      await assertRevert(Instance.upgradeTo(user.address), 'Implementation not a contract');
    });
  });

  describe('when upgrading to a non-sterile implementation', () => {
    let receipt, UpgradedImplementation, UpgradedInstance;

    before('upgrade', async () => {
      let factory;

      factory = await ethers.getContractFactory('UniversalProxyImplementationMockB');
      UpgradedImplementation = await factory.deploy();
      console.log(`New implementation Address: ${UpgradedImplementation.address}`);

      const tx = await Instance.upgradeTo(UpgradedImplementation.address);
      receipt = await tx.wait();

      UpgradedInstance = await ethers.getContractAt(
        'UniversalProxyImplementationMockB',
        ForwardingProxy.address
      );
    });

    after('rollback', async () => {
      const tx = await UpgradedInstance.upgradeTo(Implementation.address);
      receipt = await tx.wait();

      Instance = await ethers.getContractAt(
        'UniversalProxyImplementationMockA',
        ForwardingProxy.address
      );

      const event = findEvent({ receipt, eventName: 'Upgraded' });

      assert.equal(event.args.implementation, Implementation.address);

      assert.equal(await ForwardingProxy.getImplementation(), Implementation.address);
    });

    it('emitted an Upgraded event', async () => {
      const event = findEvent({ receipt, eventName: 'Upgraded' });

      assert.equal(event.args.implementation, UpgradedImplementation.address);
    });

    it('shows that the current implementation is correct', async () => {
      assert.equal(await ForwardingProxy.getImplementation(), UpgradedImplementation.address);
    });

    describe('when interacting with the implementation via the proxy', async () => {
      describe('when reading and setting a value that exists in the implementation, and sending ETH', () => {
        before('set a value and send ETH', async () => {
          await (await UpgradedInstance.setA(1337, { value: ethers.utils.parseEther('1') })).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await UpgradedInstance.getA(), 1337);
        });
      });

      describe('when reading and setting another value that exists in the implementation', () => {
        before('set a value and send ETH', async () => {
          await (await UpgradedInstance.setB(ethers.utils.formatBytes32String('Hello'))).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await UpgradedInstance.getB(), ethers.utils.formatBytes32String('Hello'));
        });
      });
    });
  });
});
