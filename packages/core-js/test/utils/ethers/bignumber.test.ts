import { ethers } from 'ethers';
import assertBn from '../../../utils/assertions/assert-bignumber';
import { bnSqrt } from '../../../utils/ethers/bignumber';

describe('utils/ethers/bignumber.js', () => {
  it('can calculate square roots', async () => {
    assertBn.equal(bnSqrt(ethers.BigNumber.from(0)), 0);
    assertBn.equal(bnSqrt(ethers.BigNumber.from(4)), 2);
    assertBn.equal(bnSqrt(ethers.BigNumber.from(123456789)), 11111);
  });
});
