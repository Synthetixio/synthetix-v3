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

  let MAX_UINT_128, MAX_UINT_256;
  let MIN_INT_128, MAX_INT_128, MAX_INT_256;

  async function assertCast(value) {
    assertBn.equal(await SafeCast[castFunction](value), value);
  }

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('SafeCastMock');
    SafeCast = await factory.deploy();
  });

  before('define min and max values', async function () {
    // Note: ethers.js has constants like `ethers.constants.MaxUint256`,
    // but they are limited, so we use our own.
    MAX_UINT_128 = pow(2, 128).sub(1);
    MIN_INT_128 = pow(2, 128).div(2).mul(-1);
    MAX_INT_128 = pow(2, 128).div(2).sub(1);
    MAX_UINT_256 = pow(2, 256).sub(1);
    MAX_INT_256 = pow(2, 256).div(2).sub(1);
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
        'Failed cast uint256 to uint128'
      );
      await assertRevert(SafeCast[castFunction](MAX_UINT_256), 'Failed cast uint256 to uint128');
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
      // Solidity does pick up overflows in parameters.
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
      // Note: These should fail with CastError,
      // but for some reason Solidity is not providing a revert reason.
      // await assertRevert(SafeCast[castFunction](-1), 'CastError(int256, uint256)');
      // await assertRevert(SafeCast[castFunction](exp(-1337, 18)), 'CastError(int256, uint256)');
      await assertRevert(SafeCast[castFunction](-1));
      await assertRevert(SafeCast[castFunction](exp(-1337, 18)));

      // Solidity does pick up overflows in parameters.
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
        'Failed cast uint128 to int128'
      );
    });
  });

  describe('int128 to uint128', function () {
    before('set the target cast function', async function () {
      castFunction = 'int128toUint128(int128)';
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
      await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), 'out-of-bounds');
      // Note: These should fail with CastError,
      // but for some reason Solidity is not providing a revert reason.
      // await assertRevert(SafeCast[castFunction](-1), 'out-of-bounds');
      await assertRevert(SafeCast[castFunction](-1));
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
        'Failed cast uint256 to int256'
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
        'Failed cast uint128 to int128'
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
      // Note: These should fail with CastError,
      // but for some reason Solidity is not providing a revert reason.
      // await assertRevert(
      //   SafeCast[castFunction](MIN_INT_128.sub(1)),
      //   'Failed cast int256 to int128'
      // );
      // await assertRevert(
      //   SafeCast[castFunction](MAX_INT_128.add(1)),
      //   'Failed cast int256 to int128'
      // );
      await assertRevert(SafeCast[castFunction](MIN_INT_128.sub(1)));
      await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)));
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
      // Solidity does pick up overflows in parameters.
      await assertRevert(SafeCast[castFunction](MIN_INT_128.sub(1)), 'out-of-bounds');
      await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), 'out-of-bounds');
    });
  });
});
