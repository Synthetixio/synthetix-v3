const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
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

  function e(base, exp) {
    return ethers.BigNumber.from(base).mul(ethers.BigNumber.from(10).pow(exp));
  }

  describe('mulDivDown()', () => {
    async function assertMulDivDown(x, y, denominator, expected) {
      assertBn.equal(
        await MathUtil.mulDivDown(
          ethers.BigNumber.from(x),
          ethers.BigNumber.from(y),
          ethers.BigNumber.from(denominator)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertMulDivDown(e(250, 25), e(50, 25), e(100, 25), e(125, 25));
      await assertMulDivDown(e(250, 16), e(50, 16), e(100, 16), e(125, 16));
      await assertMulDivDown(e(250, 6), e(50, 6), e(100, 6), e(125, 6));
      await assertMulDivDown(369, 271, 100, 999);

      await assertMulDivDown(e(10, 26), e(10, 26), e(20, 26), e(5, 26));
      await assertMulDivDown(e(100, 16), e(100, 16), e(200, 16), e(50, 16));
      await assertMulDivDown(1e8, 1e8, 2e8, 0.5e8);

      await assertMulDivDown(e(2, 27), e(3, 27), e(2, 27), e(3, 27));
      await assertMulDivDown(e(3, 18), e(2, 18), e(3, 18), e(2, 18));
      await assertMulDivDown(2e8, 3e8, 2e8, 3e8);
    });

    it('get the expected results on edge cases', async () => {
      await assertMulDivDown(0, e(1, 18), e(1, 18), 0);
      await assertMulDivDown(e(1, 18), 0, e(1, 18), 0);
      await assertMulDivDown(0, 0, e(1, 18), 0);
    });

    it('fails on div by zero', async () => {
      await assertRevert(MathUtil.mulDivDown(e(1, 18), e(1, 18), 0));
    });
  });
  describe('mulDivUp()', () => {
    async function assertMulDivUp(x, y, denominator, expected) {
      assertBn.equal(
        await MathUtil.mulDivUp(
          ethers.BigNumber.from(x),
          ethers.BigNumber.from(y),
          ethers.BigNumber.from(denominator)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertMulDivDown(e(250, 25), e(50, 25), e(100, 25), e(125, 25));
      await assertMulDivDown(e(250, 16), e(50, 16), e(100, 16), e(125, 16));
      await assertMulDivDown(e(250, 6), e(50, 6), e(100, 6), e(125, 6));
      await assertMulDivDown(369, 271, 100, 1000);

      await assertMulDivDown(e(10, 26), e(10, 26), e(20, 26), e(5, 26));
      await assertMulDivDown(e(100, 16), e(100, 16), e(200, 16), e(50, 16));
      await assertMulDivDown(1e8, 1e8, 2e8, 0.5e8);

      await assertMulDivDown(e(2, 27), e(3, 27), e(2, 27), e(3, 27));
      await assertMulDivDown(e(3, 18), e(2, 18), e(3, 18), e(2, 18));
      await assertMulDivDown(2e8, 3e8, 2e8, 3e8);

      await assertMulDivUp(1e18, 1e18, 2e18, 0.5e18);
      await assertMulDivUp(1e8, 1e8, 2e8, 0.5e8);

      await assertMulDivUp(2e27, 3e27, 2e27, 3e27);
      await assertMulDivUp(3e18, 2e18, 3e18, 2e18);
      await assertMulDivUp(2e8, 3e8, 2e8, 3e8);
    });

    it('get the expected results on edge cases', async () => {
      await assertMulDivUp(0, 1e18, 1e18, 0);
      await assertMulDivUp(1e18, 0, 1e18, 0);
      await assertMulDivUp(0, 0, 1e18, 0);
    });

    it('fails on div by zero', async () => {
      assertRevert(await MathUtil.mulDivUp(1e18, 1e18, 0));
    });
  });
});
