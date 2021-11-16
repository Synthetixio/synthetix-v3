const assert = require('assert/strict');
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { printGasUsed } = require('@synthetixio/core-js/utils/tests');
const bootstrap = require('../../helpers/bootstrap');
const { ethers } = hre;

describe('CoreCommsMixin', () => {
  const { deploymentInfo } = bootstrap();

  let SomeModule, AnotherModule;
  const WRONG_VALUE = 13;

  before('identify modules', async () => {
    const proxyAddress = getProxyAddress(deploymentInfo);

    SomeModule = await ethers.getContractAt('SomeModuleMock', proxyAddress);
    AnotherModule = await ethers.getContractAt('AnotherModuleMock', proxyAddress);
  });

  describe('when writting to GlobalNamespace.someValue', () => {
    before('set value if zero for correct gas measurements', async () => {
      const tx = await SomeModule.setSomeValue(1);
      await tx.wait();
    });

    it('directly via SomeModule', async function () {
      const tx = await SomeModule.setSomeValue(42);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(Number.parseInt(await SomeModule.getSomeValue()), 42);
    });

    it('indirectly via AnotherModule', async function () {
      const tx = await AnotherModule.setSomeValueOnSomeModule(1337);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(Number.parseInt(await SomeModule.getSomeValue()), 1337);
    });

    describe('when interacting via CommsMixin with invalid params', () => {
      it('reverts', async () => {
        await assertRevert(
          AnotherModule.setSomeValueOnSomeModule(WRONG_VALUE),
          'IntermoduleCallFailed()'
        );
      });
    });
  });
});
