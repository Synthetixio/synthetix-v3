const { ethers } = hre;
const assertBn = require('@synthetixio/core-utils/dist/utils/assertions/assert-bignumber');
const {
  default: assertRevert,
} = require('@synthetixio/core-utils/dist/utils/assertions/assert-revert');
const { printGasUsed } = require('@synthetixio/core-utils/dist/utils/mocha/mocha-helpers');
const { bootstrap } = require('@synthetixio/hardhat-router/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('CommsMixin', () => {
  const { proxyAddress } = bootstrap(initializer, { modules: '.*(Owner|Upgrade|Sample).*' });

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

      assertBn.equal(await SampleModuleA.getSomeValue(), 42);
    });

    it('indirectly via SampleModuleB', async function () {
      const tx = await SampleModuleB.setSomeValueOnSampleModuleA(1337);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assertBn.equal(await SampleModuleA.getSomeValue(), 1337);
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
