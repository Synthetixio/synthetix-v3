import { ethers } from 'ethers';

import assertBn from '../../../src/utils/assertions/assert-bignumber';
import { bnSqrt } from '../../../src/utils/ethers/bignumber';

describe('utils/ethers/bignumber.ts', function () {
  it('can calculate square roots', async function () {
    assertBn.equal(bnSqrt(ethers.BigNumber.from(0)), 0);
    assertBn.equal(bnSqrt(ethers.BigNumber.from(4)), 2);
    assertBn.equal(bnSqrt(ethers.BigNumber.from(123456789)), 11111);
  });
});
