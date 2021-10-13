const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('UniversalProxy', () => {
  let Proxy, Instance, Implementation;

  before('set up proxy and implementation', async () => {
    let factory;

    factory = await ethers.getContractFactory('UniversalProxyImplementationMockA');
    Implementation = await factory.deploy();

    factory = await ethers.getContractFactory('ForwardingProxyMock');
    Proxy = await factory.deploy(Implementation.address);

    Instance = await ethers.getContractAt('UniversalProxyImplementationMockA', Proxy.address);

    assert.equal(await Proxy.getImplementation(), Implementation.address);
  });

  describe('when UniversalProxyImplementationMockA is set as the implementation', () => {
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
            Proxy.address
          );
        });

        it('reverts', async () => {
          await assertRevert(BadInstance.getB(), 'function selector was not recognized');
        });
      });
    });
  });

  describe('when attempting to upgrade to an EOA', () => {
    it('reverts', async () => {
      const [user] = await ethers.getSigners();

      await assertRevert(Instance.upgradeTo(user.address), 'AddressIsNotContract()');
    });
  });

  describe('when attempting to upgrade to a sterile implementation', () => {
    let sterileImplementation;

    before('deploy the sterile implementation', async () => {
      const factory = await ethers.getContractFactory('ImplementationMockA');
      sterileImplementation = await factory.deploy();
    });

    it('reverts', async () => {
      await assertRevert(
        Instance.upgradeTo(sterileImplementation.address),
        'ImplementationIsSterile()'
      );
    });
  });

  describe('when attempting to brick the implementation with a bad contract', () => {
    let bricker;

    before('deploy the bad contract', async () => {
      const factory = await ethers.getContractFactory('Bricker');
      bricker = await factory.deploy();
    });

    it('reverts', async () => {
      await assertRevert(Instance.upgradeTo(bricker.address), 'ImplementationIsSterile()');
    });

    it('shows that the proxy is still responsive', async () => {
      before('set a value', async () => {
        await (await Instance.setA(1339)).wait();
      });

      it('can read the value set', async () => {
        assert.equal(await Instance.getA(), 1339);
      });
    });
  });

  describe('when attempting to destroy the implementation with a malicious contract', () => {
    let destroyer;

    before('deploy the malicious contract', async () => {
      const factory = await ethers.getContractFactory('Destroyer');
      destroyer = await factory.deploy();
    });

    describe('when trying to upgrade the implementation of the implementation to the destroyer', () => {
      it('reverts', async () => {
        await assertRevert(Instance.upgradeTo(destroyer.address), 'ImplementationIsSterile()');
      });

      it('shows that the proxy is still responsive', async () => {
        before('set a value', async () => {
          await (await Instance.setA(1338)).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await Instance.getA(), 1338);
        });
      });
    });
  });

  describe('when upgrading to a non-sterile implementation', () => {
    let receipt, UpgradedImplementation, UpgradedInstance;

    before('upgrade', async () => {
      const factory = await ethers.getContractFactory('UniversalProxyImplementationMockB');
      UpgradedImplementation = await factory.deploy();

      const tx = await Instance.upgradeTo(UpgradedImplementation.address);
      receipt = await tx.wait();

      UpgradedInstance = await ethers.getContractAt(
        'UniversalProxyImplementationMockB',
        Proxy.address
      );
    });

    after('rollback', async () => {
      const tx = await UpgradedInstance.upgradeTo(Implementation.address);
      receipt = await tx.wait();

      Instance = await ethers.getContractAt('UniversalProxyImplementationMockA', Proxy.address);

      const event = findEvent({ receipt, eventName: 'Upgraded' });

      assert.equal(event.args.implementation, Implementation.address);

      assert.equal(await Proxy.getImplementation(), Implementation.address);
    });

    it('emitted an Upgraded event', async () => {
      const event = findEvent({ receipt, eventName: 'Upgraded' });

      assert.equal(event.args.implementation, UpgradedImplementation.address);
    });

    it('shows that the current implementation is correct', async () => {
      assert.equal(await Proxy.getImplementation(), UpgradedImplementation.address);
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
