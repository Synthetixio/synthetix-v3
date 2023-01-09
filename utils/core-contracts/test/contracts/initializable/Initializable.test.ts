import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { InitializableMock } from '../../../typechain-types';

describe('Initializable', function () {
  let Initializable: InitializableMock;

  before('deploy the contract', async function () {
    const factory = await hre.ethers.getContractFactory('InitializableMock');
    Initializable = await factory.deploy();
  });

  describe('before the contract is initialized', function () {
    it('shows that is not initialized', async function () {
      assert.equal(await Initializable.isInitializableMockInitialized(), false);
    });

    describe('when attempting to access a protected function', function () {
      it('reverts', async function () {
        await assertRevert(Initializable.doubleValue(), 'NotInitialized');
      });
    });

    describe('when attempting to access a protected view', function () {
      it('reverts', async function () {
        await assertRevert(Initializable.getValue(), 'NotInitialized');
      });
    });

    describe('when attempting to reach non protected functions', function () {
      before('sets the value', async function () {
        const tx = await Initializable.setNonCriticalValue(10);
        await tx.wait();
      });

      it('gets the right value', async function () {
        assertBn.equal(await Initializable.getNonCriticalValue(), 10);
      });
    });
  });

  describe('after the contract is initialized', function () {
    before('initialize the contract', async function () {
      const tx = await Initializable.initializeInitializableMock(42);
      await tx.wait();
    });

    it('shows that is initialized', async function () {
      assert.equal(await Initializable.isInitializableMockInitialized(), true);
    });

    describe('when attempting to initialize it again', function () {
      it('reverts', async function () {
        await assertRevert(Initializable.initializeInitializableMock(42), 'AlreadyInitialized');
      });
    });

    describe('when attempting to access a protected view', function () {
      it('gets the right value', async function () {
        assertBn.equal(await Initializable.getValue(), 42);
      });
    });

    describe('when attempting to access a protected function', function () {
      before('initialize the contract', async function () {
        const tx = await Initializable.doubleValue();
        await tx.wait();
      });

      it('gets the right value', async function () {
        assertBn.equal(await Initializable.getValue(), 84);
      });
    });

    describe('when attempting to reach non protected functions', function () {
      before('sets the value', async function () {
        const tx = await Initializable.setNonCriticalValue(12);
        await tx.wait();
      });

      it('gets the right value', async function () {
        assertBn.equal(await Initializable.getNonCriticalValue(), 12);
      });
    });
  });
});
