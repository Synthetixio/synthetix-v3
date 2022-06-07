const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bnSqrt } = require('@synthetixio/core-js/utils/ethers/bignumber');

function s(base, exp) {
  return ethers.BigNumber.from(base).mul(ethers.BigNumber.from(10).pow(exp));
}

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

  describe('mulDivDown()', () => {
    async function assertMulDivDown(data, expected) {
      assertBn.equal(
        await MathUtil.mulDivDown(
          ethers.BigNumber.from(data.x),
          ethers.BigNumber.from(data.y),
          ethers.BigNumber.from(data.denominator)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertMulDivDown({ x: s(250, 25), y: s(50, 25), denominator: s(100, 25) }, s(125, 25));
      await assertMulDivDown({ x: s(250, 16), y: s(50, 16), denominator: s(100, 16) }, s(125, 16));
      await assertMulDivDown({ x: s(250, 6), y: s(50, 6), denominator: s(100, 6) }, s(125, 6));
      await assertMulDivDown({ x: 369, y: 271, denominator: 100 }, 999);

      await assertMulDivDown({ x: s(10, 26), y: s(10, 26), denominator: s(20, 26) }, s(5, 26));
      await assertMulDivDown({ x: s(100, 16), y: s(100, 16), denominator: s(200, 16) }, s(50, 16));
      await assertMulDivDown({ x: 1e8, y: 1e8, denominator: 2e8 }, 0.5e8);

      await assertMulDivDown({ x: s(2, 27), y: s(3, 27), denominator: s(2, 27) }, s(3, 27));
      await assertMulDivDown({ x: s(3, 18), y: s(2, 18), denominator: s(3, 18) }, s(2, 18));
      await assertMulDivDown({ x: 2e8, y: 3e8, denominator: 2e8 }, 3e8);
    });

    it('get the expected results on edge cases', async () => {
      await assertMulDivDown({ x: 0, y: s(1, 18), denominator: s(1, 18) }, 0);
      await assertMulDivDown({ x: s(1, 18), y: 0, denominator: s(1, 18) }, 0);
      await assertMulDivDown({ x: 0, y: 0, denominator: s(1, 18) }, 0);
    });

    it('fails on div by zero', async () => {
      await assertRevert(MathUtil.mulDivDown(s(1, 18), s(1, 18), 0));
    });
  });

  describe('mulDivUp()', () => {
    async function assertMulDivUp(data, expected) {
      assertBn.equal(
        await MathUtil.mulDivUp(
          ethers.BigNumber.from(data.x),
          ethers.BigNumber.from(data.y),
          ethers.BigNumber.from(data.denominator)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertMulDivUp({ x: s(250, 25), y: s(50, 25), denominator: s(100, 25) }, s(125, 25));
      await assertMulDivUp({ x: s(250, 16), y: s(50, 16), denominator: s(100, 16) }, s(125, 16));
      await assertMulDivUp({ x: s(250, 6), y: s(50, 6), denominator: s(100, 6) }, s(125, 6));
      await assertMulDivUp({ x: 369, y: 271, denominator: 100 }, 1000);

      await assertMulDivUp({ x: s(10, 26), y: s(10, 26), denominator: s(20, 26) }, s(5, 26));
      await assertMulDivUp({ x: s(100, 16), y: s(100, 16), denominator: s(200, 16) }, s(50, 16));
      await assertMulDivUp({ x: 1e8, y: 1e8, denominator: 2e8 }, 0.5e8);

      await assertMulDivUp({ x: s(2, 27), y: s(3, 27), denominator: s(2, 27) }, s(3, 27));
      await assertMulDivUp({ x: s(3, 18), y: s(2, 18), denominator: s(3, 18) }, s(2, 18));
      await assertMulDivUp({ x: 2e8, y: 3e8, denominator: 2e8 }, 3e8);
    });

    it('get the expected results on edge cases', async () => {
      await assertMulDivUp({ x: 0, y: s(1, 18), denominator: s(1, 18) }, 0);
      await assertMulDivUp({ x: s(1, 18), y: 0, denominator: s(1, 18) }, 0);
      await assertMulDivUp({ x: 0, y: 0, denominator: s(1, 18) }, 0);
    });

    it('fails on div by zero', async () => {
      await assertRevert(MathUtil.mulDivUp(s(1, 18), s(1, 18), 0));
    });
  });
});
