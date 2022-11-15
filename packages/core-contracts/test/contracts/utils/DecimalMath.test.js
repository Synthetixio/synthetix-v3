const { ethers } = hre;
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');

function s(base, exp) {
  return ethers.BigNumber.from(base).mul(ethers.BigNumber.from(10).pow(exp));
}

describe('DecimalMath', () => {
  let DecimalMath;

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('DecimalMathMock');
    DecimalMath = await factory.deploy();
  });

  describe('mulDivDown()', () => {
    async function assertMulDivDown(data, expected) {
      assertBn.equal(
        await DecimalMath['mulDivDown(uint256,uint256,uint256)'](
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
      await assertRevert(DecimalMath['mulDivDown(uint256,uint256,uint256)'](s(1, 18), s(1, 18), 0));
    });
  });

  describe('mulDivUp()', () => {
    async function assertMulDivUp(data, expected) {
      assertBn.equal(
        await DecimalMath.mulDivUp(
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
      await assertRevert(DecimalMath.mulDivUp(s(1, 18), s(1, 18), 0));
    });
  });

  describe('mulDecimal()', () => {
    async function assertMulDecimal(data, expected) {
      assertBn.equal(
        await DecimalMath['mulDecimal(uint256,uint256)'](
          ethers.BigNumber.from(data.x),
          ethers.BigNumber.from(data.y)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertMulDecimal({ x: s(250, 18), y: s(50, 18) }, s(12500, 18));
      await assertMulDecimal({ x: s(250, 16), y: s(50, 16) }, s(12500, 14));
      await assertMulDecimal({ x: s(250, 25), y: s(50, 25) }, s(12500, 32));
      await assertMulDecimal({ x: s(250, 18), y: s(50, 6) }, s(12500, 6));
      await assertMulDecimal({ x: s(369, 18), y: s(271, 18) }, s(99999, 18));
    });

    it('get the expected results on edge cases', async () => {
      await assertMulDecimal({ x: 0, y: s(1, 18) }, 0);
      await assertMulDecimal({ x: s(1, 18), y: 0 }, 0);
      await assertMulDecimal({ x: 0, y: 0 }, 0);
      await assertMulDecimal({ x: s(1, 9), y: s(1, 9) }, 1);
      await assertMulDecimal({ x: s(1, 77), y: 1 }, s(1, 59));
    });

    it('fails on large numbers', async () => {
      await assertRevert(DecimalMath['mulDecimal(uint256,uint256)'](s(1, 78), 1), 'out-of-bounds');
    });
  });

  describe('divDecimal()', () => {
    async function assertDivDecimal(data, expected) {
      assertBn.equal(
        await DecimalMath['divDecimal(uint256,uint256)'](
          ethers.BigNumber.from(data.x),
          ethers.BigNumber.from(data.y)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertDivDecimal({ x: s(250, 18), y: s(50, 18) }, s(5, 18));
      await assertDivDecimal({ x: s(250, 16), y: s(50, 16) }, s(5, 18));
      await assertDivDecimal({ x: s(250, 25), y: s(50, 25) }, s(5, 18));
      await assertDivDecimal({ x: s(250, 18), y: s(50, 6) }, s(5, 30));
    });

    it('get the expected results on edge cases', async () => {
      await assertDivDecimal({ x: 0, y: s(1, 18) }, 0);
      await assertDivDecimal({ x: s(1, 58), y: 1 }, s(1, 76));
    });

    it('fails on large numbers', async () => {
      await assertRevert(DecimalMath['divDecimal(uint256,uint256)'](s(1, 78), 1), 'out-of-bounds');
    });

    it('fails on divide by zero', async () => {
      await assertRevert(DecimalMath['divDecimal(uint256,uint256)'](1, 0));
    });
  });

  describe('mulDivDown() Int', () => {
    async function assertmulDivDown(data, expected) {
      assertBn.equal(
        await DecimalMath['mulDivDown(int256,int256,int256)'](
          ethers.BigNumber.from(data.x),
          ethers.BigNumber.from(data.y),
          ethers.BigNumber.from(data.denominator)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertmulDivDown({ x: s(250, 25), y: s(50, 25), denominator: s(100, 25) }, s(125, 25));
      await assertmulDivDown({ x: s(250, 16), y: s(50, 16), denominator: s(100, 16) }, s(125, 16));
      await assertmulDivDown({ x: s(250, 6), y: s(50, 6), denominator: s(100, 6) }, s(125, 6));
      await assertmulDivDown({ x: 369, y: 271, denominator: 100 }, 999);

      await assertmulDivDown({ x: s(10, 26), y: s(10, 26), denominator: s(20, 26) }, s(5, 26));
      await assertmulDivDown({ x: s(100, 16), y: s(100, 16), denominator: s(200, 16) }, s(50, 16));
      await assertmulDivDown({ x: 1e8, y: 1e8, denominator: 2e8 }, 0.5e8);

      await assertmulDivDown({ x: s(2, 27), y: s(3, 27), denominator: s(2, 27) }, s(3, 27));
      await assertmulDivDown({ x: s(3, 18), y: s(2, 18), denominator: s(3, 18) }, s(2, 18));
      await assertmulDivDown({ x: 2e8, y: 3e8, denominator: 2e8 }, 3e8);

      await assertmulDivDown(
        { x: s(-250, 18), y: s(50, 18), denominator: s(1, 18) },
        s(-12500, 18)
      );
      await assertmulDivDown(
        { x: s(250, 18), y: s(-50, 18), denominator: s(1, 18) },
        s(-12500, 18)
      );
      await assertmulDivDown(
        { x: s(-250, 18), y: s(-50, 18), denominator: s(1, 18) },
        s(12500, 18)
      );
    });

    it('get the expected results on edge cases', async () => {
      await assertmulDivDown({ x: 0, y: s(1, 18), denominator: s(1, 18) }, 0);
      await assertmulDivDown({ x: s(1, 18), y: 0, denominator: s(1, 18) }, 0);
      await assertmulDivDown({ x: 0, y: 0, denominator: s(1, 18) }, 0);
    });

    it('fails on div by zero', async () => {
      await assertRevert(DecimalMath['mulDivDown(int256,int256,int256)'](s(1, 18), s(1, 18), 0));
    });
  });

  describe('mulDecimal() Int', () => {
    async function assertMulDecimalInt(data, expected) {
      assertBn.equal(
        await DecimalMath['mulDecimal(int256,int256)'](
          ethers.BigNumber.from(data.x),
          ethers.BigNumber.from(data.y)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertMulDecimalInt({ x: s(250, 18), y: s(50, 18) }, s(12500, 18));
      await assertMulDecimalInt({ x: s(250, 16), y: s(50, 16) }, s(12500, 14));
      await assertMulDecimalInt({ x: s(250, 25), y: s(50, 25) }, s(12500, 32));
      await assertMulDecimalInt({ x: s(250, 18), y: s(50, 6) }, s(12500, 6));
      await assertMulDecimalInt({ x: s(369, 18), y: s(271, 18) }, s(99999, 18));

      await assertMulDecimalInt({ x: s(-250, 18), y: s(50, 18) }, s(-12500, 18));
      await assertMulDecimalInt({ x: s(-250, 16), y: s(50, 16) }, s(-12500, 14));
      await assertMulDecimalInt({ x: s(-250, 25), y: s(50, 25) }, s(-12500, 32));
      await assertMulDecimalInt({ x: s(-250, 18), y: s(50, 6) }, s(-12500, 6));

      await assertMulDecimalInt({ x: s(250, 18), y: s(-50, 18) }, s(-12500, 18));
      await assertMulDecimalInt({ x: s(250, 16), y: s(-50, 16) }, s(-12500, 14));
      await assertMulDecimalInt({ x: s(250, 25), y: s(-50, 25) }, s(-12500, 32));
      await assertMulDecimalInt({ x: s(250, 18), y: s(-50, 6) }, s(-12500, 6));

      await assertMulDecimalInt({ x: s(-250, 18), y: s(-50, 18) }, s(12500, 18));
      await assertMulDecimalInt({ x: s(-250, 16), y: s(-50, 16) }, s(12500, 14));
      await assertMulDecimalInt({ x: s(-250, 25), y: s(-50, 25) }, s(12500, 32));
      await assertMulDecimalInt({ x: s(-250, 18), y: s(-50, 6) }, s(12500, 6));
    });

    it('get the expected results on edge cases', async () => {
      await assertMulDecimalInt({ x: 0, y: s(1, 18) }, 0);
      await assertMulDecimalInt({ x: s(1, 18), y: 0 }, 0);
      await assertMulDecimalInt({ x: 0, y: 0 }, 0);
      await assertMulDecimalInt({ x: s(1, 9), y: s(1, 9) }, 1);
      await assertMulDecimalInt({ x: s(1, 76), y: 1 }, s(1, 58));
    });

    it('fails on large numbers', async () => {
      await assertRevert(DecimalMath['mulDecimal(int256,int256)'](s(1, 78), 1), 'out-of-bounds');
    });
  });

  describe('divDecimal() Int', () => {
    async function assertDivDecimalInt(data, expected) {
      assertBn.equal(
        await DecimalMath['divDecimal(int256,int256)'](
          ethers.BigNumber.from(data.x),
          ethers.BigNumber.from(data.y)
        ),
        ethers.BigNumber.from(expected)
      );
    }

    it('get the expected results', async () => {
      await assertDivDecimalInt({ x: s(250, 18), y: s(50, 18) }, s(5, 18));
      await assertDivDecimalInt({ x: s(250, 16), y: s(50, 16) }, s(5, 18));
      await assertDivDecimalInt({ x: s(250, 25), y: s(50, 25) }, s(5, 18));
      await assertDivDecimalInt({ x: s(250, 18), y: s(50, 6) }, s(5, 30));

      await assertDivDecimalInt({ x: s(-250, 18), y: s(50, 18) }, s(-5, 18));
      await assertDivDecimalInt({ x: s(-250, 16), y: s(50, 16) }, s(-5, 18));
      await assertDivDecimalInt({ x: s(-250, 25), y: s(50, 25) }, s(-5, 18));
      await assertDivDecimalInt({ x: s(-250, 18), y: s(50, 6) }, s(-5, 30));

      await assertDivDecimalInt({ x: s(250, 18), y: s(-50, 18) }, s(-5, 18));
      await assertDivDecimalInt({ x: s(250, 16), y: s(-50, 16) }, s(-5, 18));
      await assertDivDecimalInt({ x: s(250, 25), y: s(-50, 25) }, s(-5, 18));
      await assertDivDecimalInt({ x: s(250, 18), y: s(-50, 6) }, s(-5, 30));

      await assertDivDecimalInt({ x: s(-250, 18), y: s(-50, 18) }, s(5, 18));
      await assertDivDecimalInt({ x: s(-250, 16), y: s(-50, 16) }, s(5, 18));
      await assertDivDecimalInt({ x: s(-250, 25), y: s(-50, 25) }, s(5, 18));
      await assertDivDecimalInt({ x: s(-250, 18), y: s(-50, 6) }, s(5, 30));
    });

    it('get the expected results on edge cases', async () => {
      await assertDivDecimalInt({ x: 0, y: s(1, 18) }, 0);
      await assertDivDecimalInt({ x: s(1, 58), y: 1 }, s(1, 76));
    });

    it('fails on large numbers', async () => {
      await assertRevert(DecimalMath['divDecimal(int256,int256)'](s(1, 78), 1), 'out-of-bounds');
    });

    it('fails on divide by zero', async () => {
      await assertRevert(DecimalMath['divDecimal(int256,int256)'](1, 0)); // TODO
    });
  });
});
