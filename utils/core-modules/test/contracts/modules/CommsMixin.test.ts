import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { printGasUsed } from '@synthetixio/core-utils/utils/mocha/mocha-helpers';
import { SampleModuleA, SampleModuleB } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('CommsMixin', () => {
  const { getContract } = bootstrap({ implementation: 'SampleRouter' });

  let SampleModuleA: SampleModuleA;
  let SampleModuleB: SampleModuleB;

  before('identify modules', () => {
    SampleModuleA = getContract('SampleModuleA');
    SampleModuleB = getContract('SampleModuleB');
  });

  describe('when writting to SampleNamespace.someValue', () => {
    before('set value if zero for correct gas measurements', async () => {
      const tx = await SampleModuleA.setSomeValue(1);
      await tx.wait();
    });

    it('directly via SampleModuleA', async function () {
      const tx = await SampleModuleA.setSomeValue(42);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed.toNumber() });

      assertBn.equal(await SampleModuleA.getSomeValue(), 42);
    });

    it('indirectly via SampleModuleB', async function () {
      const tx = await SampleModuleB.setSomeValueOnSampleModuleA(1337);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed.toNumber() });

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
