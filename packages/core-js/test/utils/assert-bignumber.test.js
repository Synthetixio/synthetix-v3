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
  it('#eq', function () {
    bn.eq(BigNumber.from(12), BigNumber.from('12'));
    bn.eq(BigNumber.from(12), BigNumber.from(12));
    bn.eq(BigNumber.from(12), 12);
    bn.eq('12', 12);
    bn.eq('12', '12');
    not('eq', BigNumber.from(12), BigNumber.from('72'));
    not('eq', BigNumber.from(13), BigNumber.from(12));
    not('eq', BigNumber.from(12), 5);
    not('eq', '12', 0x123123123);
    not('eq', '12', '1');
  });

  it('#lt', function () {
    bn.lt(BigNumber.from(12), BigNumber.from(24));
    bn.lt(BigNumber.from(13), BigNumber.from(14));
    not('lt', BigNumber.from(12), BigNumber.from(12));
    not('lt', BigNumber.from(12), BigNumber.from(11));
  });

  it('#lte', function () {
    bn.lte(BigNumber.from(12), BigNumber.from(24));
    bn.lte(BigNumber.from(13), BigNumber.from(14));
    bn.lte(BigNumber.from(13), BigNumber.from(13));
    not('lte', BigNumber.from(15), BigNumber.from(14));
  });

  it('#gt', function () {
    bn.gt(BigNumber.from(15), BigNumber.from(13));
    not('gt', BigNumber.from(15), BigNumber.from(15));
    not('gt', BigNumber.from(15), BigNumber.from(16));
  });

  it('#gte', function () {
    bn.gte(BigNumber.from(15), BigNumber.from(13));
    bn.gte(BigNumber.from(15), BigNumber.from(15));
    not('gte', BigNumber.from(14), BigNumber.from(15));
  });

  it('#isZero', function () {
    bn.isZero(1);
    not('isZero', BigNumber.from(1));
  });
});
