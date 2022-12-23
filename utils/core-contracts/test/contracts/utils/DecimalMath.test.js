const { ethers } = hre;
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');

function s(base, exp) {
  return ethers.BigNumber.from(base).mul(ethers.BigNumber.from(10).pow(exp));
}

describe('DecimalMath', () => {
  let DecimalMath;
  let mulSignature, divSignature, upSignature, downSignature;

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('DecimalMathMock');
    DecimalMath = await factory.deploy();
  });

  async function assertFn(data, expected, fn) {
    assertBn.equal(
      await DecimalMath[fn](ethers.BigNumber.from(data.x), ethers.BigNumber.from(data.y)),
      ethers.BigNumber.from(expected)
    );
  }

  async function assertMulDecimal(data, expected) {
    await assertFn(data, expected, mulSignature);
  }

  async function assertDivDecimal(data, expected) {
    await assertFn(data, expected, divSignature);
  }

  async function assertUpscale(data, expected) {
    await assertFn(data, expected, upSignature);
  }

  async function assertDownscale(data, expected) {
    await assertFn(data, expected, downSignature);
  }

  describe('uint256', function () {
    before('assign signatures', async function () {
      mulSignature = 'mulDecimal(uint256,uint256)';
      divSignature = 'divDecimal(uint256,uint256)';
      upSignature = 'upscale(uint256,uint256)';
      downSignature = 'downscale(uint256,uint256)';
    });

    describe('mulDecimal()', () => {
      it('produces the expected results', async () => {
        await assertMulDecimal({ x: s(250, 18), y: s(50, 18) }, s(12500, 18));
        await assertMulDecimal({ x: s(250, 16), y: s(50, 16) }, s(12500, 14));
        await assertMulDecimal({ x: s(250, 25), y: s(50, 25) }, s(12500, 32));
        await assertMulDecimal({ x: s(250, 18), y: s(50, 6) }, s(12500, 6));
        await assertMulDecimal({ x: s(369, 18), y: s(271, 18) }, s(99999, 18));
      });

      it('produces the expected results on edge cases', async () => {
        await assertMulDecimal({ x: 0, y: s(1, 18) }, 0);
        await assertMulDecimal({ x: s(1, 18), y: 0 }, 0);
        await assertMulDecimal({ x: 0, y: 0 }, 0);
        await assertMulDecimal({ x: s(1, 9), y: s(1, 9) }, 1);
        await assertMulDecimal({ x: s(1, 77), y: 1 }, s(1, 59));
      });

      it('fails on large numbers', async () => {
        await assertRevert(DecimalMath[mulSignature](s(1, 78), 1), 'out-of-bounds');
      });
    });

    describe('divDecimal()', () => {
      it('produces the expected results', async () => {
        await assertDivDecimal({ x: s(250, 18), y: s(50, 18) }, s(5, 18));
        await assertDivDecimal({ x: s(250, 16), y: s(50, 16) }, s(5, 18));
        await assertDivDecimal({ x: s(250, 25), y: s(50, 25) }, s(5, 18));
        await assertDivDecimal({ x: s(250, 18), y: s(50, 6) }, s(5, 30));
      });

      it('produces the expected results on edge cases', async () => {
        await assertDivDecimal({ x: 0, y: s(1, 18) }, 0);
        await assertDivDecimal({ x: s(1, 58), y: 1 }, s(1, 76));
      });

      it('fails on large numbers', async () => {
        await assertRevert(DecimalMath[divSignature](s(1, 78), 1), 'out-of-bounds');
      });

      it('fails on divide by zero', async () => {
        await assertRevert(DecimalMath[divSignature](1, 0), 'Panic');
      });
    });

    describe('upscale()', function () {
      it('produces the expected results', async function () {
        await assertUpscale({ x: s(250, 18), y: s(9, 1) }, s(250, 27));
      });
    });

    describe('downscale()', function () {
      it('produces the expected results', async function () {
        await assertDownscale({ x: s(250, 27), y: s(9, 1) }, s(250, 18));
      });
    });
  });

  describe('uint128', function () {
    before('assign signatures', async function () {
      mulSignature = 'mulDecimalUint128(uint128,uint128)';
      divSignature = 'divDecimalUint128(uint128,uint128)';
      upSignature = 'upscaleUint128(uint128,uint256)';
      downSignature = 'downscaleUint128(uint128,uint256)';
    });

    describe('mulDecimal()', () => {
      it('produces the expected results', async () => {
        await assertMulDecimal({ x: s(25, 18), y: s(5, 18) }, s(125, 18));
        await assertMulDecimal({ x: s(25, 16), y: s(5, 16) }, s(125, 14));
        await assertMulDecimal({ x: s(25, 18), y: s(5, 6) }, s(125, 6));
        await assertMulDecimal({ x: s(36, 18), y: s(2, 18) }, s(72, 18));
      });

      it('produces the expected results on edge cases', async () => {
        await assertMulDecimal({ x: 0, y: s(1, 18) }, 0);
        await assertMulDecimal({ x: s(1, 18), y: 0 }, 0);
        await assertMulDecimal({ x: 0, y: 0 }, 0);
        await assertMulDecimal({ x: s(1, 9), y: s(1, 9) }, 1);
        await assertMulDecimal({ x: s(1, 37), y: 1 }, s(1, 19));
      });

      it('fails on large numbers', async () => {
        await assertRevert(DecimalMath[mulSignature](s(1, 78), 1), 'out-of-bounds');
      });
    });

    describe('divDecimal()', () => {
      it('produces the expected results', async () => {
        await assertDivDecimal({ x: s(20, 18), y: s(5, 18) }, s(4, 18));
        await assertDivDecimal({ x: s(25, 16), y: s(5, 16) }, s(5, 18));
        await assertDivDecimal({ x: s(20, 18), y: s(5, 6) }, s(4, 30));
        await assertDivDecimal({ x: s(20, 18), y: s(5, 6) }, s(4, 30));
      });

      it('produces the expected results on edge cases', async () => {
        await assertDivDecimal({ x: 0, y: s(1, 18) }, 0);
        await assertDivDecimal({ x: s(1, 19), y: 1 }, s(1, 37));
      });

      it('fails on large numbers', async () => {
        await assertRevert(DecimalMath[divSignature](s(1, 39), 1), 'out-of-bounds');
      });

      it('fails on divide by zero', async () => {
        await assertRevert(DecimalMath[divSignature](1, 0), 'Panic');
      });
    });

    describe('upscale()', function () {
      it('produces the expected results', async function () {
        await assertUpscale({ x: s(250, 18), y: s(9, 1) }, s(250, 27));
      });
    });

    describe('downscale()', function () {
      it('produces the expected results', async function () {
        await assertDownscale({ x: s(250, 27), y: s(9, 1) }, s(250, 18));
      });
    });
  });

  describe('int256', function () {
    before('assign signatures', async function () {
      mulSignature = 'mulDecimal(int256,int256)';
      divSignature = 'divDecimal(int256,int256)';
      upSignature = 'upscale(int256,uint256)';
      downSignature = 'downscale(int256,uint256)';
    });

    describe('mulDecimal() int256', function () {
      it('produces the expected results', async () => {
        await assertMulDecimal({ x: s(250, 18), y: s(50, 18) }, s(12500, 18));
        await assertMulDecimal({ x: s(250, 16), y: s(50, 16) }, s(12500, 14));
        await assertMulDecimal({ x: s(250, 25), y: s(50, 25) }, s(12500, 32));
        await assertMulDecimal({ x: s(250, 18), y: s(50, 6) }, s(12500, 6));
        await assertMulDecimal({ x: s(369, 18), y: s(271, 18) }, s(99999, 18));

        await assertMulDecimal({ x: s(-250, 18), y: s(50, 18) }, s(-12500, 18));
        await assertMulDecimal({ x: s(-250, 16), y: s(50, 16) }, s(-12500, 14));
        await assertMulDecimal({ x: s(-250, 25), y: s(50, 25) }, s(-12500, 32));
        await assertMulDecimal({ x: s(-250, 18), y: s(50, 6) }, s(-12500, 6));
        await assertMulDecimal({ x: s(-369, 18), y: s(271, 18) }, s(-99999, 18));

        await assertMulDecimal({ x: s(250, 18), y: s(-50, 18) }, s(-12500, 18));
        await assertMulDecimal({ x: s(250, 16), y: s(-50, 16) }, s(-12500, 14));
        await assertMulDecimal({ x: s(250, 25), y: s(-50, 25) }, s(-12500, 32));
        await assertMulDecimal({ x: s(250, 18), y: s(-50, 6) }, s(-12500, 6));
        await assertMulDecimal({ x: s(369, 18), y: s(-271, 18) }, s(-99999, 18));

        await assertMulDecimal({ x: s(-250, 18), y: s(-50, 18) }, s(12500, 18));
        await assertMulDecimal({ x: s(-250, 16), y: s(-50, 16) }, s(12500, 14));
        await assertMulDecimal({ x: s(-250, 25), y: s(-50, 25) }, s(12500, 32));
        await assertMulDecimal({ x: s(-250, 18), y: s(-50, 6) }, s(12500, 6));
        await assertMulDecimal({ x: s(-369, 18), y: s(-271, 18) }, s(99999, 18));
      });

      it('produces the expected results on edge cases', async () => {
        await assertMulDecimal({ x: 0, y: s(1, 18) }, 0);
        await assertMulDecimal({ x: s(1, 18), y: 0 }, 0);
        await assertMulDecimal({ x: 0, y: 0 }, 0);
        await assertMulDecimal({ x: s(1, 9), y: s(1, 9) }, 1);
        await assertMulDecimal({ x: s(1, 57), y: 1 }, s(1, 39));
      });

      it('fails on large numbers', async () => {
        await assertRevert(DecimalMath[mulSignature](s(1, 77), 1), 'out-of-bounds');
      });
    });

    describe('divDecimal() int256', () => {
      it('produces the expected results', async () => {
        await assertDivDecimal({ x: s(250, 18), y: s(50, 18) }, s(5, 18));
        await assertDivDecimal({ x: s(250, 16), y: s(50, 16) }, s(5, 18));
        await assertDivDecimal({ x: s(250, 25), y: s(50, 25) }, s(5, 18));
        await assertDivDecimal({ x: s(250, 18), y: s(50, 6) }, s(5, 30));

        await assertDivDecimal({ x: s(-250, 18), y: s(50, 18) }, s(-5, 18));
        await assertDivDecimal({ x: s(-250, 16), y: s(50, 16) }, s(-5, 18));
        await assertDivDecimal({ x: s(-250, 25), y: s(50, 25) }, s(-5, 18));
        await assertDivDecimal({ x: s(-250, 18), y: s(50, 6) }, s(-5, 30));

        await assertDivDecimal({ x: s(250, 18), y: s(-50, 18) }, s(-5, 18));
        await assertDivDecimal({ x: s(250, 16), y: s(-50, 16) }, s(-5, 18));
        await assertDivDecimal({ x: s(250, 25), y: s(-50, 25) }, s(-5, 18));
        await assertDivDecimal({ x: s(250, 18), y: s(-50, 6) }, s(-5, 30));

        await assertDivDecimal({ x: s(-250, 18), y: s(-50, 18) }, s(5, 18));
        await assertDivDecimal({ x: s(-250, 16), y: s(-50, 16) }, s(5, 18));
        await assertDivDecimal({ x: s(-250, 25), y: s(-50, 25) }, s(5, 18));
        await assertDivDecimal({ x: s(-250, 18), y: s(-50, 6) }, s(5, 30));
      });

      it('produces the expected results on edge cases', async () => {
        await assertDivDecimal({ x: 0, y: s(1, 18) }, 0);
        await assertDivDecimal({ x: s(1, 58), y: 1 }, s(1, 76));
      });

      it('fails on large numbers', async () => {
        await assertRevert(DecimalMath[divSignature](s(1, 59), 1), 'Panic');
      });

      it('fails on divide by zero', async () => {
        await assertRevert(DecimalMath[divSignature](1, 0), 'Panic');
      });
    });

    describe('upscale()', function () {
      it('produces the expected results', async function () {
        await assertUpscale({ x: s(250, 18), y: s(9, 1) }, s(250, 27));
      });
    });

    describe('downscale()', function () {
      it('produces the expected results', async function () {
        await assertDownscale({ x: s(250, 27), y: s(9, 1) }, s(250, 18));
      });
    });
  });

  describe('int128', function () {
    before('assign signatures', async function () {
      mulSignature = 'mulDecimalInt128(int128,int128)';
      divSignature = 'divDecimalInt128(int128,int128)';
      upSignature = 'upscale(int128,uint256)';
      downSignature = 'downscale(int128,uint256)';
    });

    describe('mulDecimal() int128', function () {
      it('produces the expected results', async () => {
        await assertMulDecimal({ x: s(25, 18), y: s(5, 18) }, s(125, 18));
        await assertMulDecimal({ x: s(25, 16), y: s(5, 16) }, s(125, 14));
        await assertMulDecimal({ x: s(25, 18), y: s(5, 6) }, s(125, 6));
        await assertMulDecimal({ x: s(36, 18), y: s(2, 18) }, s(72, 18));

        await assertMulDecimal({ x: s(-25, 18), y: s(5, 18) }, s(-125, 18));
        await assertMulDecimal({ x: s(-25, 16), y: s(5, 16) }, s(-125, 14));
        await assertMulDecimal({ x: s(-25, 18), y: s(5, 6) }, s(-125, 6));
        await assertMulDecimal({ x: s(-36, 18), y: s(2, 18) }, s(-72, 18));

        await assertMulDecimal({ x: s(25, 18), y: s(-5, 18) }, s(-125, 18));
        await assertMulDecimal({ x: s(25, 16), y: s(-5, 16) }, s(-125, 14));
        await assertMulDecimal({ x: s(25, 18), y: s(-5, 6) }, s(-125, 6));
        await assertMulDecimal({ x: s(36, 18), y: s(-2, 18) }, s(-72, 18));

        await assertMulDecimal({ x: s(-25, 18), y: s(-5, 18) }, s(125, 18));
        await assertMulDecimal({ x: s(-25, 16), y: s(-5, 16) }, s(125, 14));
        await assertMulDecimal({ x: s(-25, 18), y: s(-5, 6) }, s(125, 6));
        await assertMulDecimal({ x: s(-36, 18), y: s(-2, 18) }, s(72, 18));
      });

      it('produces the expected results on edge cases', async () => {
        await assertMulDecimal({ x: 0, y: s(1, 18) }, 0);
        await assertMulDecimal({ x: s(1, 18), y: 0 }, 0);
        await assertMulDecimal({ x: 0, y: 0 }, 0);
        await assertMulDecimal({ x: s(1, 9), y: s(1, 9) }, 1);
        await assertMulDecimal({ x: s(1, 37), y: 1 }, s(1, 19));
      });

      it('fails on large numbers', async () => {
        await assertRevert(DecimalMath[mulSignature](s(1, 39), 1), 'out-of-bounds');
      });
    });

    describe('divDecimal() int128', () => {
      it('produces the expected results', async () => {
        await assertDivDecimal({ x: s(20, 18), y: s(5, 18) }, s(4, 18));
        await assertDivDecimal({ x: s(25, 16), y: s(5, 16) }, s(5, 18));
        await assertDivDecimal({ x: s(20, 18), y: s(5, 6) }, s(4, 30));
        await assertDivDecimal({ x: s(20, 18), y: s(5, 6) }, s(4, 30));

        await assertDivDecimal({ x: s(-20, 18), y: s(5, 18) }, s(-4, 18));
        await assertDivDecimal({ x: s(-25, 16), y: s(5, 16) }, s(-5, 18));
        await assertDivDecimal({ x: s(-20, 18), y: s(5, 6) }, s(-4, 30));
        await assertDivDecimal({ x: s(-20, 18), y: s(5, 6) }, s(-4, 30));

        await assertDivDecimal({ x: s(20, 18), y: s(-5, 18) }, s(-4, 18));
        await assertDivDecimal({ x: s(25, 16), y: s(-5, 16) }, s(-5, 18));
        await assertDivDecimal({ x: s(20, 18), y: s(-5, 6) }, s(-4, 30));
        await assertDivDecimal({ x: s(20, 18), y: s(-5, 6) }, s(-4, 30));

        await assertDivDecimal({ x: s(-20, 18), y: s(-5, 18) }, s(4, 18));
        await assertDivDecimal({ x: s(-25, 16), y: s(-5, 16) }, s(5, 18));
        await assertDivDecimal({ x: s(-20, 18), y: s(-5, 6) }, s(4, 30));
        await assertDivDecimal({ x: s(-20, 18), y: s(-5, 6) }, s(4, 30));
      });

      it('produces the expected results on edge cases', async () => {
        await assertDivDecimal({ x: 0, y: s(1, 18) }, 0);
        await assertDivDecimal({ x: s(1, 19), y: 1 }, s(1, 37));
      });

      it('fails on large numbers', async () => {
        await assertRevert(DecimalMath[divSignature](s(1, 39), 1), 'out-of-bounds');
      });

      it('fails on divide by zero', async () => {
        await assertRevert(DecimalMath[divSignature](1, 0), 'Panic');
      });
    });

    describe('upscale()', function () {
      it('produces the expected results', async function () {
        await assertUpscale({ x: s(250, 18), y: s(9, 1) }, s(250, 27));
      });
    });

    describe('downscale()', function () {
      it('produces the expected results', async function () {
        await assertDownscale({ x: s(250, 27), y: s(9, 1) }, s(250, 18));
      });
    });
  });
});
