const ethers = require('ethers');
const assertBn = require('../../../utils/assertions/assert-bignumber');
const { bnSqrt } = require('../../../utils/ethers/bignumber');

describe('utils/ethers/bignumber.js', () => {
  it('can calculate square roots', async () => {
    assertBn.equal(bnSqrt(ethers.BigNumber.from(0)), 0);
    assertBn.equal(bnSqrt(ethers.BigNumber.from(4)), 2);
    assertBn.equal(bnSqrt(ethers.BigNumber.from(123456789)), 11111);
  });
});
