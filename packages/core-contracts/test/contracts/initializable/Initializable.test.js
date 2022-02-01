const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');

describe('Initializable', () => {
  let Initializable;

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('InitializableMock');
    Initializable = await factory.deploy();
  });

  describe('before the contract is initialized', () => {
    it('shows that is not initialized', async () => {
      assert.equal(await Initializable.isInitializableMockInitialized(), false);
    });

    describe('when attempting to access a protected function', () => {
      it('reverts', async () => {
        await assertRevert(Initializable.doubleValue(), 'NotInitialized');
      });
    });

    describe('when attempting to access a protected view', () => {
      it('reverts', async () => {
        await assertRevert(Initializable.getValue(), 'NotInitialized');
      });
    });

    describe('when attempting to reach non protected functions', () => {
      before('sets the value', async () => {
        let tx = await Initializable.setNonCriticalValue(10);
        await tx.wait();
      });

      it('gets the right value', async () => {
        assertBn.equal(await Initializable.getNonCriticalValue(), 10);
      });
    });
  });

  describe('after the contract is initialized', () => {
    before('initialize the contract', async () => {
      let tx = await Initializable.initializeInitializableMock(42);
      await tx.wait();
    });

    it('shows that is initialized', async () => {
      assert.equal(await Initializable.isInitializableMockInitialized(), true);
    });

    describe('when attempting to initialize it again', () => {
      it('reverts', async () => {
        await assertRevert(Initializable.initializeInitializableMock(42), 'AlreadyInitialized');
      });
    });

    describe('when attempting to access a protected view', () => {
      it('gets the right value', async () => {
        assertBn.equal(await Initializable.getValue(), 42);
      });
    });

    describe('when attempting to access a protected function', () => {
      before('initialize the contract', async () => {
        let tx = await Initializable.doubleValue();
        await tx.wait();
      });

      it('gets the right value', async () => {
        assertBn.equal(await Initializable.getValue(), 84);
      });
    });

    describe('when attempting to reach non protected functions', () => {
      before('sets the value', async () => {
        let tx = await Initializable.setNonCriticalValue(12);
        await tx.wait();
      });

      it('gets the right value', async () => {
        assertBn.equal(await Initializable.getNonCriticalValue(), 12);
      });
    });
  });
});
