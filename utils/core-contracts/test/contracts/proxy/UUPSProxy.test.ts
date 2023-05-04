import assert from 'node:assert/strict';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import {
  ImplementationDestroyer,
  ImplementationMockA,
  ImplementationMockB,
  UUPSProxy,
  UUPSProxy__factory,
} from '../../../typechain-types';

describe('UUPSProxy', function () {
  let UUPSProxy: UUPSProxy;

  let user: ethers.Signer;

  let initialBalance: BigNumber;

  const value = ethers.utils.parseEther('1');

  before('identify signers', async function () {
    [user] = await hre.ethers.getSigners();
  });

  describe('validate', function () {
    // This validation is useful because the Proxy is intended to have a Router
    // or another kind of contract with the full implementation, so, if we allow
    // the definition of public methods here it would override those methods.
    it('does not have any public methods', async function () {
      const publicFunctions = UUPSProxy__factory.abi.filter((item) => item.type === 'function');

      if (publicFunctions.length) {
        throw new Error('The UUPSProxy should not have public facing functions');
      }
    });
  });

  describe('when deploying the proxy with invalid parameters', function () {
    let UUPSProxyFactory: UUPSProxy__factory;
    let Implementation: ImplementationMockA;

    before('deploy the implementation', async function () {
      const factory = await hre.ethers.getContractFactory('ImplementationMockA');
      UUPSProxyFactory = await hre.ethers.getContractFactory('UUPSProxy');

      Implementation = await factory.deploy();
      UUPSProxy = await UUPSProxyFactory.deploy(Implementation.address);
    });

    describe('when setting an EOA as the first implementation', function () {
      it('reverts', async function () {
        await assertRevert(
          UUPSProxyFactory.deploy(await user.getAddress()),
          `NotAContract("${await user.getAddress()}")`,
          UUPSProxy
        );
      });
    });

    describe('when setting the zero address as the first implementation', function () {
      it('reverts', async function () {
        await assertRevert(
          UUPSProxyFactory.deploy('0x0000000000000000000000000000000000000000'),
          'ZeroAddress()',
          UUPSProxy
        );
      });
    });
  });

  describe('when deploying the proxy and setting implementation A as the first implementation', function () {
    let Instance: ImplementationMockA;
    let Implementation: ImplementationMockA;

    before('deploy the implementation', async function () {
      const factory = await hre.ethers.getContractFactory('ImplementationMockA');
      Implementation = await factory.deploy();
    });

    before('deploy the proxy', async function () {
      const factory = await hre.ethers.getContractFactory('UUPSProxy');
      UUPSProxy = await factory.deploy(Implementation.address);
      Instance = await hre.ethers.getContractAt('ImplementationMockA', UUPSProxy.address);
    });

    it('shows that the implementation is set', async function () {
      assert.equal(await Instance.getImplementation(), Implementation.address);
    });

    describe('when trying to interact with methods that A does not have', function () {
      let BadInstance: ImplementationMockB;

      before('wrap the implementation', async function () {
        BadInstance = await hre.ethers.getContractAt('ImplementationMockB', UUPSProxy.address);
      });

      it('reverts', async function () {
        await assertRevert(BadInstance.getB(), 'call revert exception');
      });
    });

    describe('when interacting with implementation A', function () {
      before('set a value', async function () {
        await (await Instance.setA(42)).wait();
      });

      it('can read the value set', async function () {
        assertBn.equal(await Instance.getA(), 42);
      });

      describe('when sending ETH while interacting with a non payable function', function () {
        it('reverts', async function () {
          await assertRevert(
            Instance.setA(1337, { value } as unknown as undefined),
            'non-payable method'
          );
        });
      });

      describe('when sending ETH to the proxy', function () {
        it('reverts, since the implementation has no payable fallback', async function () {
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

    describe('when trying to upgrade to an EOA', function () {
      it('reverts', async function () {
        await assertRevert(
          Instance.upgradeTo(await user.getAddress()),
          `NotAContract("${await user.getAddress()}")`,
          UUPSProxy
        );
      });
    });

    describe('when trying to upgrade to the current implementation', function () {
      it('reverts', async function () {
        await assertRevert(Instance.upgradeTo(Implementation.address), 'NoChange()', UUPSProxy);
      });
    });

    describe('when trying to upgrade to the zero address', function () {
      it('reverts', async function () {
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        await assertRevert(Instance.upgradeTo(zeroAddress), 'ZeroAddress', UUPSProxy);
      });
    });

    describe('when upgrading to implementation B', function () {
      let upgradeReceipt: TransactionReceipt;
      let NewInstance: ImplementationMockB;
      let Implementation: ImplementationMockB;

      before('deploy the implementation', async function () {
        const factory = await hre.ethers.getContractFactory('ImplementationMockB');
        Implementation = await factory.deploy();
      });

      before('upgrade', async function () {
        const tx = await Instance.upgradeTo(Implementation.address);
        upgradeReceipt = await tx.wait();

        NewInstance = await hre.ethers.getContractAt('ImplementationMockB', UUPSProxy.address);
      });

      it('shows that the implementation is set', async function () {
        assert.equal(await NewInstance.getImplementation(), Implementation.address);
      });

      it('emitted an Upgraded event', async function () {
        const evt = findEvent({ receipt: upgradeReceipt, eventName: 'Upgraded' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.implementation, Implementation.address);
      });

      describe('when interacting with implementation B', function () {
        before('set a value', async function () {
          await (await NewInstance.setB('hello')).wait();
        });

        it('can read the value previously set', async function () {
          assertBn.equal(await NewInstance.getA(), 42);
        });

        it('can read the new value set', async function () {
          assert.equal(await NewInstance.getB(), 'hello');
        });

        describe('when sending ETH while interacting with a payable function', function () {
          before('record the initial balance', async function () {
            initialBalance = await hre.ethers.provider.getBalance(UUPSProxy.address);
          });

          before('interact with value', async function () {
            await (await NewInstance.setB('howdy', { value })).wait();
          });

          it('increases the proxys balance', async function () {
            const newBalance = await hre.ethers.provider.getBalance(UUPSProxy.address);
            const deltaBalance = newBalance.sub(initialBalance);

            assert.deepEqual(deltaBalance, value);
          });
        });

        describe('when sending ETH to the proxy', function () {
          before('record the initial balance', async function () {
            initialBalance = await hre.ethers.provider.getBalance(UUPSProxy.address);
          });

          before('send ETH', async function () {
            await (await user.sendTransaction({ value, to: UUPSProxy.address })).wait();
          });

          it('incrases the proxys balance', async function () {
            const newBalance = await hre.ethers.provider.getBalance(UUPSProxy.address);
            const deltaBalance = newBalance.sub(initialBalance);

            assert.deepEqual(deltaBalance, value);
          });
        });
      });
    });

    describe('when trying to brick the proxy', function () {
      describe('when trying to destroy the implementaion', function () {
        let Destroyer: ImplementationDestroyer;

        before('deploy the malicious implementation', async function () {
          const factory = await hre.ethers.getContractFactory('ImplementationDestroyer');
          Destroyer = await factory.deploy();
        });

        it('reverts', async function () {
          await assertRevert(
            Implementation.upgradeTo(Destroyer.address),
            `ImplementationIsSterile("${Destroyer.address}")`
          );
        });
      });

      describe('when trying to upgrade to a sterile implementation', function () {
        let Implementation: ethers.Contract;

        before('deploy the implementation', async function () {
          const factory = await hre.ethers.getContractFactory('SterileImplementation');
          Implementation = await factory.deploy();
        });

        it('reverts', async function () {
          await assertRevert(
            Instance.upgradeTo(Implementation.address),
            `ImplementationIsSterile("${Implementation.address}")`
          );
        });
      });
    });
  });
});
