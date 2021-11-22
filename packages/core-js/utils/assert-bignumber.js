const { AssertionError } = require('assert/strict');
const { BigNumber } = require('ethers');

class BigNumberAssertionError extends AssertionError {}

function _createAssertBN(operator) {
  return function _assertBn(a, b) {
    const result = BigNumber.from(a)[operator](b);

    if (!result) {
      throw new BigNumberAssertionError({
        actual: b,
        expected: a,
        operator,
      });
    }
  };
}

module.exports = {
  /**
   * Error thrown when assertion fails
   */
  BigNumberAssertionError,

  /**
   * Assert if two given numbers are equal
   * @param {(string|number|BigNumber)} a
   * @param {(string|number|BigNumber)} b
   */
  eq: _createAssertBN('eq'),

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
  isZero: _createAssertBN('isZero'),
};
