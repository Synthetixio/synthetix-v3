import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { GenericModule, Router } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

// TODO: fix assert-revert to parse this error
describe.skip('RouterCoverage', function () {
  const { getContract } = bootstrap({ implementation: 'CoreRouter' });

  let Router: Router;

  before('identify modules', function () {
    Router = getContract('CoreRouter');
  });

  describe('when attempting to reach an unexistent function in Router', function () {
    let GenericModule: GenericModule;

    before('identify modules', function () {
      GenericModule = getContract('GenericModule');
    });

    it('reverts', async function () {
      await assertRevert(
        GenericModule.getFortyTwo(),
        `UnknownSelector("${ethers.utils.id('getFortyTwo()').slice(0, 10)}")`,
        Router
      );
    });
  });
});
