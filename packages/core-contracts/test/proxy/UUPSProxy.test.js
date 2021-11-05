const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('UUPSProxy', () => {
  let UUPSProxy, Instance, Implementation;

  describe('when deploying the proxy and setting implementation A as the first implementation', () => {
    before('deploy the implementation', async () => {
      const factory = await ethers.getContractFactory('ImplementationMockA');
      Implementation = await factory.deploy();
    });

    before('deploy the proxy', async () => {
      const factory = await ethers.getContractFactory('UUPSProxy');
      UUPSProxy = await factory.deploy(Implementation.address);

      Instance = await ethers.getContractAt('ImplementationMockA', UUPSProxy.address);
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await Instance.getImplementation(), Implementation.address);
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
        BadInstance = await ethers.getContractAt('ImplementationMockB', UUPSProxy.address);
      });

      it('reverts', async () => {
        await assertRevert(BadInstance.getB(), 'function selector was not recognized');
      });
    });

    describe('when trying to upgrade to an EOA', () => {
      it('reverts', async () => {
        const [user] = await ethers.getSigners();
        await assertRevert(Instance.upgradeTo(user.address), `InvalidContract("${user.address}")`);
      });
    });

    describe('when trying to upgrade to the zero address', () => {
      it('reverts', async () => {
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        await assertRevert(Instance.upgradeTo(zeroAddress), `InvalidAddress("${zeroAddress}")`);
      });
    });

    describe('when upgrading to implementation B', () => {
      before('deploy the implementation', async () => {
        const factory = await ethers.getContractFactory('ImplementationMockB');
        Implementation = await factory.deploy();
      });

      before('upgrade', async () => {
        const tx = await Instance.upgradeTo(Implementation.address);
        await tx.wait();

        Instance = await ethers.getContractAt('ImplementationMockB', UUPSProxy.address);
      });

      it('shows that the implementation is set', async () => {
        assert.equal(await Instance.getImplementation(), Implementation.address);
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

  //   after('rollback', async () => {
  //     const tx = await UpgradedInstance.upgradeTo(Implementation.address);
  //     receipt = await tx.wait();

  //     Instance = await ethers.getContractAt('UUPSImplementationMockA', Proxy.address);

  //     const event = findEvent({ receipt, eventName: 'Upgraded' });

  //     assert.equal(event.args.implementation, Implementation.address);

  //     assert.equal(await Proxy.getImplementation(), Implementation.address);
  //   });

  //   it('emitted an Upgraded event', async () => {
  //     const event = findEvent({ receipt, eventName: 'Upgraded' });

  //     assert.equal(event.args.implementation, UpgradedImplementation.address);
  //   });

  //   it('shows that the current implementation is correct', async () => {
  //     assert.equal(await Proxy.getImplementation(), UpgradedImplementation.address);
  //   });

  //   describe('when interacting with the implementation via the proxy', async () => {
  //     describe('when reading and setting a value that exists in the implementation, and sending ETH', () => {
  //       before('set a value and send ETH', async () => {
  //         await (await UpgradedInstance.setA(1337, { value: ethers.utils.parseEther('1') })).wait();
  //       });

  //       it('can read the value set', async () => {
  //         assert.equal(await UpgradedInstance.getA(), 1337);
  //       });
  //     });

  //     describe('when reading and setting another value that exists in the implementation', () => {
  //       before('set a value and send ETH', async () => {
  //         await (await UpgradedInstance.setB(ethers.utils.formatBytes32String('Hello'))).wait();
  //       });

  //       it('can read the value set', async () => {
  //         assert.equal(await UpgradedInstance.getB(), ethers.utils.formatBytes32String('Hello'));
  //       });
  //     });
  //   });
  // });
});
