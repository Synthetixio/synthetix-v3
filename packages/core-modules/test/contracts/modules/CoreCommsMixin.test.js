const hre = require('hardhat');
const assert = require('assert');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const bn = require('@synthetixio/core-js/utils/assert-bignumber');

const { ethers } = hre;

describe('CoreCommsMixin', () => {
  let SomeModuleMockImp, AnotherModuleMockImp, Router;
  const WRONG_VALUE = 13;

  before('deploy the contracts', async () => {
    let factory;
    factory = await ethers.getContractFactory('SomeModuleMock');
    SomeModuleMockImp = await factory.deploy();
    factory = await ethers.getContractFactory('AnotherModuleMock');
    AnotherModuleMockImp = await factory.deploy();
  });

  before('setup the mock router', async () => {
    const factory = await ethers.getContractFactory('RouterMock');
    Router = await factory.deploy(SomeModuleMockImp.address, AnotherModuleMockImp.address);
  });

  it('shows that the mocked setup is set', async () => {
    assert.equal(await Router.anotherModuleImp(), AnotherModuleMockImp.address);
  });

  describe('when interacting with SomeModule', () => {
    let SomeModule;
    before('get the implementation', async () => {
      SomeModule = await ethers.getContractAt('SomeModuleMock', Router.address);
    });

    before('set the first value directly', async () => {
      const tx = await SomeModule.setSomeValue(42);
      await tx.wait();
    });

    it('shows that the value was set', async () => {
      bn.eq(await SomeModule.getSomeValue(), 42);
    });

    describe('when interacting via CommsMixin', () => {
      before('update the value via CommsMixin', async () => {
        const tx = await Router.callAnotherModule(
          AnotherModuleMockImp.interface.encodeFunctionData('setSomeValueOnSomeModule', [1337])
        );
        await tx.wait();
      });

      it('shows that the value was updated', async () => {
        bn.eq(await SomeModule.getSomeValue(), 1337);
      });
    });

    describe('when interacting via CommsMixin with invalid params', () => {
      it('reverts', async () => {
        await assertRevert(
          Router.callAnotherModule(
            AnotherModuleMockImp.interface.encodeFunctionData('setSomeValueOnSomeModule', [
              WRONG_VALUE,
            ])
          ),
          'DelegateCallError()'
        );
      });
    });
  });
});
