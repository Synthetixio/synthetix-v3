const assert = require('assert/strict');
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { printGasUsed } = require('@synthetixio/core-js/utils/tests');
const bootstrap = require('../../helpers/bootstrap');
const { ethers } = hre;

describe('CommsMixin', () => {
  const { deploymentInfo } = bootstrap();

  let SampleModuleA, SampleModuleB;

  before('identify modules', async () => {
    const proxyAddress = getProxyAddress(deploymentInfo);

    SampleModuleA = await ethers.getContractAt('SampleModuleA', proxyAddress);
    SampleModuleB = await ethers.getContractAt('SampleModuleB', proxyAddress);
  });

  describe('when writting to SampleNamespace.someValue', () => {
    before('set value if zero for correct gas measurements', async () => {
      const tx = await SampleModuleA.setSomeValue(1);
      await tx.wait();
    });

    it('directly via SampleModuleA', async function () {
      const tx = await SampleModuleA.setSomeValue(42);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(Number.parseInt(await SampleModuleA.getSomeValue()), 42);
    });

    it('indirectly via SampleModuleB', async function () {
      const tx = await SampleModuleB.setSomeValueOnSampleModuleA(1337);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(Number.parseInt(await SampleModuleA.getSomeValue()), 1337);
    });

    describe('when interacting via CommsMixin with invalid params', () => {
      it('reverts', async () => {
        await assertRevert(
          SampleModuleB.setSomeValueOnSampleModuleA(13),
          'IntermoduleCallFailed()'
        );
      });
    });
  });
});
