const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { printGasUsed } = require('@synthetixio/core-js/utils/tests');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('CommsMixin', () => {
  const { proxyAddress } = bootstrap(initializer);

  let SampleModuleA, SampleModuleB;

  before('identify modules', async () => {
    SampleModuleA = await ethers.getContractAt('SampleModuleA', proxyAddress());
    SampleModuleB = await ethers.getContractAt('SampleModuleB', proxyAddress());
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

      assertBn.eq(await SampleModuleA.getSomeValue(), 42);
    });

    it('indirectly via SampleModuleB', async function () {
      const tx = await SampleModuleB.setSomeValueOnSampleModuleA(1337);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assertBn.eq(await SampleModuleA.getSomeValue(), 1337);
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
