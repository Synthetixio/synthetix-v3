const { BigNumber } = require('ethers');
const bn = require('../../utils/assert-bignumber');

function not(operator, a, b) {
  try {
    bn[operator](a, b);
    throw new Error(`Expected to throw: bn.${operator}(${a}, ${b})`);
  } catch (err) {
    if (err instanceof bn.BigNumberAssertionError) return;
    throw err;
  }
}

describe('utils/assert-bignumber.js', function () {
  it('correctly coerces strings and numbers to BigNumber', function () {
    bn.eq(BigNumber.from(12), BigNumber.from(12));
    bn.eq(12, BigNumber.from(12));
    bn.eq('13', BigNumber.from(13));
    bn.eq(12, '12');
  });

  it('#eq', function () {
    bn.eq(12, 12);
    not('eq', 12, 13);
  });

  it('#lt', function () {
    bn.lt(12, 24);
    bn.lt(13, 14);
    not('lt', 12, 12);
    not('lt', 12, 11);
  });

  it('#lte', function () {
    bn.lte(12, 24);
    bn.lte(13, 14);
    bn.lte(13, 13);
    not('lte', 15, 14);
  });

  it('#gt', function () {
    bn.gt(15, 13);
    not('gt', 15, 15);
    not('gt', 15, 16);
  });

  it('#gte', function () {
    bn.gte(15, 13);
    bn.gte(15, 15);
    not('gte', 14, 15);
  });

  it('#isZero', function () {
    bn.isZero(0);
    not('isZero', 1);
  });
});
