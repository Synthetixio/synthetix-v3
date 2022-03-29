const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { bnSqrt } = require('@synthetixio/core-js/utils/ethers/bignumber');

describe('MathUtil', () => {
  let MathUtil;

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('MathUtilMock');
    MathUtil = await factory.deploy();
  });

  describe('sqrt(x)', () => {
    function sqrt(value) {
      return Math.floor(Math.sqrt(value));
    }

    async function assertSqrt(value) {
      assertBn.equal(await MathUtil.sqrt(value), sqrt(value));
    }

    async function assertBnSqrt(value) {
      assertBn.equal(await MathUtil.sqrt(value), bnSqrt(value));
    }

    it('calculates small square roots', async function () {
      await assertSqrt(0);
      await assertSqrt(4);
      await assertSqrt(42);
      await assertSqrt(1337);
      await assertSqrt(20000);
      await assertSqrt(450000);
      await assertSqrt(10333333);
      await assertSqrt(100000000);
    });

    it('calculates big roots', async () => {
      await assertBnSqrt(ethers.utils.parseEther('0'));
      await assertBnSqrt(ethers.utils.parseEther('4'));
      await assertBnSqrt(ethers.utils.parseEther('42'));
      await assertBnSqrt(ethers.utils.parseEther('1337'));
      await assertBnSqrt(ethers.utils.parseEther('20000'));
      await assertBnSqrt(ethers.utils.parseEther('450000'));
      await assertBnSqrt(ethers.utils.parseEther('10333333'));
      await assertBnSqrt(ethers.utils.parseEther('100000000'));
    });
  });
});
