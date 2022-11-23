const { ethers } = hre;
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');

function exp(base, exp) {
  return ethers.BigNumber.from(base).mul(ethers.BigNumber.from(10).pow(exp));
}

function pow(base, exp) {
  return ethers.BigNumber.from(base).pow(exp);
}

describe('SafeCast', () => {
  let SafeCast;
  let castFunction;

  let MAX_UINT_256;
  let MAX_UINT_128;
  let MIN_INT_128, MAX_INT_128;
  let MAX_INT_256;

  async function assertCast(value) {
    // Using callStatic because the mock's functions are not view,
    // i.e. they are regular transactions and don't return a value.
    // They need to not be view because otherwise ethers assumes they can't throw,
    // so it wont parse the returned custom errors.
    // The solution is to use callStatic, which forces ethers to both retrieve the
    // returned value, and parse revert errors.
    assertBn.equal(await SafeCast.callStatic[castFunction](value), value);
  }

  function castError(fromType, toType) {
    return `CastError("${ethers.utils.formatBytes32String(
      fromType
    )}", "${ethers.utils.formatBytes32String(toType)}")`;
  }

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('SafeCastMock');
    SafeCast = await factory.deploy();
  });

  before('define min and max values', async function () {
    // Note: ethers.js has constants like `ethers.constants.MaxUint256`,
    // but they are limited in variety, so we use our own.

    MAX_UINT_256 = pow(2, 256).sub(1);

    MAX_UINT_128 = pow(2, 128).sub(1);

    MAX_INT_256 = pow(2, 256).div(2).sub(1);

    MIN_INT_128 = pow(2, 128).div(2).mul(-1);
    MAX_INT_128 = pow(2, 128).div(2).sub(1);
  });

  describe('uint256 to uint128', function () {
    before('set the target cast function', async function () {
      castFunction = 'uint256toUint128(uint256)';
    });

    it('produces expected results', async function () {
      await assertCast(42);
      await assertCast(exp(1337, 18));
    });

    it('produces expected results on edge cases', async function () {
      await assertCast(0);
      await assertCast(MAX_UINT_128);
    });

    it('throws on overflows', async function () {
      await assertRevert(
        SafeCast[castFunction](MAX_UINT_128.add(1)),
        castError('uint256', 'uint128')
      );
      await assertRevert(SafeCast[castFunction](MAX_UINT_256), castError('uint256', 'uint128'));
    });
  });

  describe('uint128 to uint256', function () {
    before('set the target cast function', async function () {
      castFunction = 'uint128toUint256(uint128)';
    });

    it('produces expected results', async function () {
      await assertCast(42);
      await assertCast(exp(1337, 18));
    });

    it('produces expected results on edge cases', async function () {
      await assertCast(0);
      await assertCast(MAX_UINT_128);
    });

    it('throws on overflows', async function () {
      // Solidity does pick up overflows in parameters with out-of-bounds errors.
      await assertRevert(SafeCast[castFunction](MAX_UINT_256.add(1)), 'out-of-bounds');
    });
  });

  describe('int256 to uint256', function () {
    before('set the target cast function', async function () {
      castFunction = 'int256toUint256(int256)';
    });

    it('produces expected results', async function () {
      await assertCast(42);
      await assertCast(exp(1337, 18));
    });

    it('produces expected results on edge cases', async function () {
      await assertCast(0);
      await assertCast(MAX_INT_256);
    });

    it('throws on overflows', async function () {
      await assertRevert(SafeCast[castFunction](-1), castError('int256', 'uint256'));
      await assertRevert(SafeCast[castFunction](exp(-1337, 18)), castError('int256', 'uint256'));

      await assertRevert(SafeCast[castFunction](MAX_INT_256.add(1)), 'out-of-bounds');
    });
  });

  describe('uint128 to int128', function () {
    before('set the target cast function', async function () {
      castFunction = 'uint128toInt128(uint128)';
    });

    it('produces expected results', async function () {
      await assertCast(42);
      await assertCast(exp(1337, 18));
    });

    it('produces expected results on edge cases', async function () {
      await assertCast(0);
      await assertCast(MAX_INT_128);
    });

    it('throws on overflows', async function () {
      await assertRevert(
        SafeCast[castFunction](MAX_INT_128.add(1)),
        castError('uint128', 'int128')
      );
    });
  });

  describe('uint256 to int256', function () {
    before('set the target cast function', async function () {
      castFunction = 'uint256toInt256(uint256)';
    });

    it('produces expected results', async function () {
      await assertCast(42);
      await assertCast(exp(1337, 18));
    });

    it('produces expected results on edge cases', async function () {
      await assertCast(0);
      await assertCast(MAX_INT_256);
    });

    it('throws on overflows', async function () {
      await assertRevert(
        SafeCast[castFunction](MAX_INT_256.add(1)),
        castError('uint256', 'int256')
      );
    });
  });

  describe('uint128 to int256 (through int128)', function () {
    before('set the target cast function', async function () {
      castFunction = 'uint128toInt256(uint128)';
    });

    it('produces expected results', async function () {
      await assertCast(42);
      await assertCast(exp(1337, 18));
    });

    it('produces expected results on edge cases', async function () {
      await assertCast(0);
      await assertCast(MAX_INT_128);
    });

    it('throws on overflows', async function () {
      await assertRevert(
        SafeCast[castFunction](MAX_INT_128.add(1)),
        castError('uint128', 'int128')
      );
    });
  });

  describe('int256 to int128', function () {
    before('set the target cast function', async function () {
      castFunction = 'int256toInt128(int256)';
    });

    it('produces expected results', async function () {
      await assertCast(42);
      await assertCast(exp(1337, 18));
      await assertCast(-42);
      await assertCast(exp(-1337, 18));
    });

    it('produces expected results on edge cases', async function () {
      await assertCast(MIN_INT_128);
      await assertCast(0);
      await assertCast(MAX_INT_128);
    });

    it('throws on overflows', async function () {
      await assertRevert(SafeCast[castFunction](MIN_INT_128.sub(1)), castError('int256', 'int128'));
      await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), castError('int256', 'int128'));
    });
  });

  describe('int128 to int256', function () {
    before('set the target cast function', async function () {
      castFunction = 'int128toInt256(int128)';
    });

    it('produces expected results', async function () {
      await assertCast(42);
      await assertCast(exp(1337, 18));
      await assertCast(-42);
      await assertCast(exp(-1337, 18));
    });

    it('produces expected results on edge cases', async function () {
      await assertCast(MIN_INT_128);
      await assertCast(0);
      await assertCast(MAX_INT_128);
    });

    it('throws on overflows', async function () {
      await assertRevert(SafeCast[castFunction](MIN_INT_128.sub(1)), 'out-of-bounds');
      await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), 'out-of-bounds');
    });
  });
});
