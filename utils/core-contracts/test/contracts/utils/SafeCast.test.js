const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');

describe('SafeCast', () => {
  let SafeCast;
  let castFunction;

  function exp(base, exp) {
    return ethers.BigNumber.from(base).mul(ethers.BigNumber.from(10).pow(exp));
  }

  function pow(base, exp) {
    return ethers.BigNumber.from(base).pow(exp);
  }

  async function assertCast(value) {
    // Using callStatic because the mock's functions are not view,
    // i.e. they are regular transactions and don't return a value.
    // They need to not be view because otherwise ethers assumes they can't throw,
    // so it wont parse the returned custom errors.
    // The solution is to use callStatic, which forces ethers to both retrieve the
    // returned value, and parse revert errors.
    assertBn.equal(await SafeCast.callStatic[castFunction](value), value);
  }

  async function assertCastBytes(value) {
    assert.equal(
      await SafeCast.callStatic[castFunction](value),
      ethers.utils.hexZeroPad(ethers.BigNumber.from(value).toHexString(), 32)
    );
  }

  function maxUint(type) {
    return pow(2, type).sub(1);
  }

  function maxInt(type) {
    return pow(2, type).div(2).sub(1);
  }

  function minInt(type) {
    return pow(2, type).div(2).mul(-1);
  }

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('SafeCastMock');
    SafeCast = await factory.deploy();
  });

  describe('SafeCastU32', function () {
    describe('toInt()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint32toInt32(uint32)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 4));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxInt(32));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](maxInt(32).add(1)), 'OverflowUint32ToInt32()');
      });
    });

    describe('to256()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint32toUint256(uint32)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 8));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxUint(32));
      });
    });
  });

  describe('SafeCastI32', function () {
    describe('toUint()', function () {
      before('set the target cast function', async function () {
        castFunction = 'int32toUint32(int32)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 4));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxInt(32));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](pow(-1, 1)), 'OverflowInt32ToUint32()');
      });
    });
  });

  describe('SafeCastU64', function () {
    describe('toInt()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint64toInt64(uint64)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 8));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxInt(64));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](maxInt(64).add(1)), 'OverflowUint64ToInt64()');
      });
    });
  });

  describe('SafeCastI128', function () {
    describe('toUint()', function () {
      before('set the target cast function', async function () {
        castFunction = 'int128toUint128(int128)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 16));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxInt(128));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](pow(-1, 1)), 'OverflowInt128ToUint128()');
      });
    });

    describe('to256()', function () {
      before('set the target cast function', async function () {
        castFunction = 'int128toInt256(int128)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 16));
        await assertCast(exp(-42, 16));
      });
    });

    describe('to32()', function () {
      before('set the target cast function', async function () {
        castFunction = 'int128toInt32(int128)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 4));
        await assertCast(exp(-42, 4));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](minInt(32).sub(1)), 'OverflowInt128ToInt32()');
        await assertRevert(SafeCast[castFunction](maxInt(32).add(1)), 'OverflowInt128ToInt32()');
      });
    });

    describe('zero()', function () {
      it('returns the expected result', async function () {
        assertBn.equal(await SafeCast.zeroI128(), 0);
      });
    });
  });

  describe('SafeCastI256', function () {
    describe('to128()', function () {
      before('set the target cast function', async function () {
        castFunction = 'int256toInt128(int256)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 16));
        await assertCast(-42);
        await assertCast(exp(-42, 16));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxInt(128));
        await assertCast(minInt(128));
      });

      it('throws Vjon overflows', async function () {
        await assertRevert(SafeCast[castFunction](minInt(128).sub(1)), 'OverflowInt256ToInt128()');
        await assertRevert(SafeCast[castFunction](maxInt(128).add(1)), 'OverflowInt256ToInt128()');
      });
    });

    describe('toUint()', function () {
      before('set the target cast function', async function () {
        castFunction = 'int256toUint256(int256)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 16));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxInt(128));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](pow(-1, 1)), 'OverflowInt256ToUint256()');
      });
    });
  });

  describe('SafeCastU128', function () {
    describe('to256()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint128toUint256(uint128)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 16));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxUint(128));
      });
    });

    describe('toInt()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint128toInt128(uint128)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 16));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxInt(128));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](maxUint(128)), 'OverflowUint128ToInt128()');
      });
    });

    describe('toBytes32()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint128toBytes32(uint128)';
      });

      it('returns the expected results', async function () {
        await assertCastBytes(42);
      });
    });
  });

  describe('SafeCastU256', function () {
    describe('to128()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint256toUint128(uint256)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 16));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxUint(128));
      });

      it('throws on overflows', async function () {
        await assertRevert(
          SafeCast[castFunction](maxUint(128).add(1)),
          'OverflowUint256ToUint128()'
        );
      });
    });

    describe('to64()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint256toUint64(uint256)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 8));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxUint(64));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](maxUint(64).add(1)), 'OverflowUint256ToUint64()');
      });
    });

    describe('toBytes32()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint256toBytes32(uint256)';
      });

      it('returns the expected results', async function () {
        await assertCastBytes(42);
      });
    });

    describe('toInt()', function () {
      before('set the target cast function', async function () {
        castFunction = 'uint256toInt256(uint256)';
      });

      it('produces expected results', async function () {
        await assertCast(42);
        await assertCast(exp(42, 16));
      });

      it('produces expected results on edge cases', async function () {
        await assertCast(0);
        await assertCast(maxInt(256));
      });

      it('throws on overflows', async function () {
        await assertRevert(SafeCast[castFunction](maxInt(256).add(1)), 'OverflowUint256ToInt256()');
      });
    });
  });

  // describe('uint256 to uint128', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'uint256toUint128(uint256)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(0);
  //     await assertCast(MAX_UINT_128);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](MAX_UINT_128.add(1)), 'OverflowUint256ToUint128()');
  //     await assertRevert(SafeCast[castFunction](MAX_UINT_256), 'OverflowUint256ToUint128()');
  //   });
  // });

  // describe('uint128 to bytes32', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'uint128toBytes32(uint128)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCastBytes(42);
  //     await assertCastBytes(exp(1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCastBytes(0);
  //     await assertCastBytes(MAX_UINT_128);
  //   });
  // });

  // describe('uint128 to uint256', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'uint128toUint256(uint128)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(0);
  //     await assertCast(MAX_UINT_128);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](MAX_UINT_256.add(1)), 'out-of-bounds');
  //   });
  // });

  // describe('int256 to uint256', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'int256toUint256(int256)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(0);
  //     await assertCast(MAX_INT_256);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](-1), 'OverflowInt256ToUint256()');
  //     await assertRevert(SafeCast[castFunction](exp(-1337, 18)), 'OverflowInt256ToUint256()');

  //     await assertRevert(SafeCast[castFunction](MAX_INT_256.add(1)), 'out-of-bounds');
  //   });
  // });

  // describe('uint128 to int128', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'uint128toInt128(uint128)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(0);
  //     await assertCast(MAX_INT_128);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), 'OverflowUint128ToInt128()');
  //   });
  // });

  // describe('int128 to uint128', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'int128toUint128(int128)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(0);
  //     await assertCast(MAX_INT_128);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), 'out-of-bounds');
  //     await assertRevert(SafeCast[castFunction](-1), 'OverflowInt128ToUint128()');
  //   });
  // });

  // describe('uint256 to int256', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'uint256toInt256(uint256)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(0);
  //     await assertCast(MAX_INT_256);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](MAX_INT_256.add(1)), 'OverflowUint256ToInt256()');
  //   });
  // });

  // describe('uint128 to int256 (through int128)', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'uint128toInt256(uint128)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(0);
  //     await assertCast(MAX_INT_128);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), 'OverflowUint128ToInt128()');
  //   });
  // });

  // describe('int256 to int128', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'int256toInt128(int256)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //     await assertCast(-42);
  //     await assertCast(exp(-1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(MIN_INT_128);
  //     await assertCast(0);
  //     await assertCast(MAX_INT_128);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](MIN_INT_128.sub(1)), 'OverflowInt256ToInt128()');
  //     await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), 'OverflowInt256ToInt128()');
  //   });
  // });

  // describe('int128 to int256', function () {
  //   before('set the target cast function', async function () {
  //     castFunction = 'int128toInt256(int128)';
  //   });

  //   it('produces expected results', async function () {
  //     await assertCast(42);
  //     await assertCast(exp(1337, 18));
  //     await assertCast(-42);
  //     await assertCast(exp(-1337, 18));
  //   });

  //   it('produces expected results on edge cases', async function () {
  //     await assertCast(MIN_INT_128);
  //     await assertCast(0);
  //     await assertCast(MAX_INT_128);
  //   });

  //   it('throws on overflows', async function () {
  //     await assertRevert(SafeCast[castFunction](MIN_INT_128.sub(1)), 'out-of-bounds');
  //     await assertRevert(SafeCast[castFunction](MAX_INT_128.add(1)), 'out-of-bounds');
  //   });
  // });
});
