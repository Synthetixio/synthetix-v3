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

  describe.skip('when attempts to upgrade to an EOA', () => {
    it('reverts', async () => {
      const [user] = await ethers.getSigners();

      await assertRevert(Instance.upgradeTo(user.address), 'Implementation not a contract');
    });
  });

  describe.skip('when attempts to upgrade to a sterile implementation', () => {
    it('reverts', async () => {
      let factory;

      factory = await ethers.getContractFactory('ImplementationMockA');
      const sterileImplementation = await factory.deploy();

      await assertRevert(
        Instance.upgradeTo(sterileImplementation.address),
        'Implementation is sterile'
      );
    });
  });

  describe('when upgrading to a non-sterile implementation', () => {
    let receipt, implementationB, InstanceB;

    before('upgrade', async () => {
      let factory;

      factory = await ethers.getContractFactory('UniversalProxyImplementationMockB');
      implementationB = await factory.deploy();
      console.log(`New implementation Address: ${implementationB.address}`);

      const tx = await Instance.upgradeTo(implementationB.address);
      receipt = await tx.wait();

      InstanceB = await ethers.getContractAt(
        'UniversalProxyImplementationMockB',
        ForwardingProxy.address
      );
    });

    it('emitted an Upgraded event', async () => {
      const event = findEvent({ receipt, eventName: 'Upgraded' });

      assert.equal(event.args.implementation, implementationB.address);
    });

    it('shows that the current implementation is correct', async () => {
      assert.equal(await ForwardingProxy.getImplementation(), implementationB.address);
    });

    describe('when interacting with the implementation via the proxy', async () => {
      describe('when reading and setting a value that exists in the implementation, and sending ETH', () => {
        before('set a value and send ETH', async () => {
          await (await InstanceB.setA(1337, { value: ethers.utils.parseEther('1') })).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await InstanceB.getA(), 1337);
        });
      });

      describe('when reading and setting another value that exists in the implementation', () => {
        before('set a value and send ETH', async () => {
          await (await InstanceB.setB(ethers.utils.formatByte32String('Hello'))).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await InstanceB.getB(), ethers.utils.formatByte32String('Hello'));
        });
      });
    });
  });

  describe.skip('when attempting to destroy the implementation with a malicious contract', () => {
    let destroyer;

    before('deploy the malicious contract', async () => {
      const factory = await ethers.getContractFactory('Destroyer');
      destroyer = await factory.deploy();
    });

    describe('when trying to upgrade the implementation of the implementation to the destroyer', () => {
      it('reverts', async () => {
        await assertRevert(Instance.upgradeTo(destroyer.address), 'Implementation is sterile');
      });

      it('shows that the code of the implementation is not null', async () => {
        const code = await ethers.provider.getCode(Instance.address);

        assert.notEqual(code, '0x');
      });

      describe('when trying to continue operating with the proxy', async () => {
        before('set a value and send ETH', async () => {
          await (await Instance.setA(1338, { value: ethers.utils.parseEther('1') })).wait();
        });

        it('shows that the proxy is still responsive', async () => {
          assert.equal(await Instance.getA(), 1338);
        });
      });
    });
  });
});
