const { ethers } = hre;
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('UUPSProxy', () => {
  let UUPSProxy, Instance, Implementation;

  let user;

  let initialBalance;

  const value = ethers.utils.parseEther('1');

  before('identify signers', async () => {
    [user] = await ethers.getSigners();
  });

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

    describe('when trying to interact with methods that A does not have', () => {
      let BadInstance;

      before('wrap the implementation', async () => {
        BadInstance = await ethers.getContractAt('ImplementationMockB', UUPSProxy.address);
      });

      it('reverts', async () => {
        await assertRevert(BadInstance.getB(), 'function selector was not recognized');
      });
    });

    describe('when interacting with implementation A', () => {
      before('set a value', async () => {
        await (await Instance.setA(42)).wait();
      });

      it('can read the value set', async () => {
        assert.equal(await Instance.getA(), 42);
      });

      describe('when sending ETH while interacting with a non payable function', () => {
        it('reverts', async () => {
          await assertRevert(Instance.setA(1337, { value }), 'non-payable method');
        });
      });

      describe('when sending ETH to the proxy', () => {
        it('reverts, since the implementation has no payable fallback', async () => {
          await assertRevert(
            user.sendTransaction({
              to: UUPSProxy.address,
              value,
            }),
            'no fallback nor receive function'
          );
        });
      });
    });

    describe('when trying to upgrade to an EOA', () => {
      it('reverts', async () => {
        await assertRevert(
          Instance.safeUpgradeTo(user.address),
          `InvalidContract("${user.address}")`
        );
      });
    });

    describe('when trying to upgrade to the zero address', () => {
      it('reverts', async () => {
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        await assertRevert(Instance.safeUpgradeTo(zeroAddress), `InvalidAddress("${zeroAddress}")`);
      });
    });

    describe('when upgrading to implementation B', () => {
      let upgradeReceipt;

      before('deploy the implementation', async () => {
        const factory = await ethers.getContractFactory('ImplementationMockB');
        Implementation = await factory.deploy();
      });

      before('upgrade', async () => {
        const tx = await Instance.safeUpgradeTo(Implementation.address);
        upgradeReceipt = await tx.wait();

        Instance = await ethers.getContractAt('ImplementationMockB', UUPSProxy.address);
      });

      it('shows that the implementation is set', async () => {
        assert.equal(await Instance.getImplementation(), Implementation.address);
      });

      it('emitted an Upgraded event', async () => {
        const event = findEvent({ receipt: upgradeReceipt, eventName: 'Upgraded' });

        assert.equal(event.args.implementation, Implementation.address);
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

        describe('when sending ETH while interacting with a payable function', () => {
          before('record the initial balance', async () => {
            initialBalance = await ethers.provider.getBalance(UUPSProxy.address);
          });

          before('interact with value', async () => {
            await (await Instance.setB('howdy', { value })).wait();
          });

          it('increases the proxys balance', async () => {
            const newBalance = await ethers.provider.getBalance(UUPSProxy.address);
            const deltaBalance = newBalance.sub(initialBalance);

            assert.deepEqual(deltaBalance, value);
          });
        });

        describe('when sending ETH to the proxy', () => {
          before('record the initial balance', async () => {
            initialBalance = await ethers.provider.getBalance(UUPSProxy.address);
          });

          before('send ETH', async () => {
            await (await user.sendTransaction({ value, to: UUPSProxy.address })).wait();
          });

          it('incrases the proxys balance', async () => {
            const newBalance = await ethers.provider.getBalance(UUPSProxy.address);
            const deltaBalance = newBalance.sub(initialBalance);

            assert.deepEqual(deltaBalance, value);
          });
        });
      });
    });

    describe('when trying to brick the proxy', () => {
      describe('when trying to destroy the implementaion', () => {
        let Destroyer;

        before('deploy the malicious implementation', async () => {
          const factory = await ethers.getContractFactory('ImplementationDestroyer');
          Destroyer = await factory.deploy();
        });

        describe('via safeUpgradeTo', () => {
          it('reverts', async () => {
            await assertRevert(Implementation.safeUpgradeTo(Destroyer.address), 'UpgradeToNotCalledViaProxy');
          });
        });

        describe('via unsafeUpgradeTo', () => {
          it('reverts', async () => {
            await assertRevert(Implementation.unsafeUpgradeTo(Destroyer.address), 'UpgradeToNotCalledViaProxy');
          });
        });
      });

      describe('when trying to upgrade to a sterile implementation', () => {
        before('deploy the implementation', async () => {
          const factory = await ethers.getContractFactory('SterileImplementation');
          Implementation = await factory.deploy();
        });

        it('reverts', async () => {
          await assertRevert(
            Instance.safeUpgradeTo(Implementation.address),
            'SterileImplementation'
          );
        });
      });
    });
  });
});
