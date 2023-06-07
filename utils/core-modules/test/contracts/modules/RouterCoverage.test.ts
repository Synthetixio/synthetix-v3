/* eslint-disable @typescript-eslint/ban-ts-comment */

import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { GenericModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

// TODO: fix assert-revert to parse this error
describe.skip('RouterCoverage', function () {
  const { getContractBehindProxy } = bootstrap({ implementation: 'CoreRouter' });
  //@ts-ignore This tests is skipped, fix type when enabled tests
  let Router: Router;

  before('identify modules', function () {
    Router = getContractBehindProxy('CoreRouter');
  });

  describe('when attempting to reach an unexistent function in Router', function () {
    let GenericModule: GenericModule;

    before('identify modules', function () {
      GenericModule = getContractBehindProxy('GenericModule');
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
