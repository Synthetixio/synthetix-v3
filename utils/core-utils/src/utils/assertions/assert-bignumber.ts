import { AssertionError } from 'assert/strict';
import { BigNumber, BigNumberish } from 'ethers';

class BigNumberAssertionError extends AssertionError {}

// https://stackoverflow.com/questions/56863875/
// typescript-how-do-you-filter-a-types-properties-to-those-of-a-certain-type
type KeysMatching<T extends object, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

function _createAssertBN(operator: KeysMatching<BigNumber, (v: BigNumberish) => boolean>) {
  return function _assertBn(a: BigNumberish, b: BigNumberish) {
    const result = BigNumber.from(a)[operator](b);

    if (!result) {
      throw new BigNumberAssertionError({
        actual: a.toString(),
        expected: b.toString(),
        operator,
      });
    }
  };
}

export = {
  /**
   * Error thrown when assertion fails
   */
  BigNumberAssertionError,

  /**
   * Assert if two given numbers are equal
   * @param {(string|number|BigNumber)} a
   * @param {(string|number|BigNumber)} b
   */
  equal: _createAssertBN('eq'),

  /**
   * Assert if `a` is less than than `b`
   * @param {(string|number|BigNumber)} a
   * @param {(string|number|BigNumber)} b
   */
  lt: _createAssertBN('lt'),

  /**
   * Assert if `a` is less than or equal to `b`
   * @param {(string|number|BigNumber)} a
   * @param {(string|number|BigNumber)} b
   */
  lte: _createAssertBN('lte'),

  /**
   * Assert if `a` is greater than `b`
   * @param {(string|number|BigNumber)} a
   * @param {(string|number|BigNumber)} b
   */
  gt: _createAssertBN('gt'),

  /**
   * Assert if `a` is greater than or equal to `b`
   * @param {(string|number|BigNumber)} a
   * @param {(string|number|BigNumber)} b
   */
  gte: _createAssertBN('gte'),

  /**
   * Assert if `a` is zero
   * @param {(string|number|BigNumber)} a
   */
  isZero(a: BigNumberish) {
    if (!BigNumber.from(a).isZero()) {
      throw new BigNumberAssertionError({
        actual: a,
        expected: BigNumber.from(0),
        operator: 'isZero',
      });
    }
  },

  /**
   * Assert if `a` is within a small range of `b`
   */
  near(a: BigNumberish, b: BigNumberish, tolerance: BigNumberish = 10000) {
    const abn = BigNumber.from(a);
    const bbn = BigNumber.from(b);
    const tolerancebn = BigNumber.from(tolerance);

    const lower = bbn.sub(tolerancebn);
    const upper = bbn.add(tolerancebn);

    if (abn.lt(lower) || abn.gt(upper)) {
      throw new BigNumberAssertionError({
        actual: abn,
        expected: bbn,
        operator: 'near',
      });
    }
  },
};
