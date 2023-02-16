import { throws } from 'node:assert';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import bn from '../../../src/utils/assertions/assert-bignumber';

// https://stackoverflow.com/questions/56863875/
// typescript-how-do-you-filter-a-types-properties-to-those-of-a-certain-type
type KeysMatching<T extends object, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

function not(
  operator: KeysMatching<typeof bn, (a: BigNumberish, b: BigNumberish) => void>,
  a: ethers.BigNumberish,
  b: ethers.BigNumberish
) {
  try {
    bn[operator](a, b);
    throw new Error(`Expected to throw: bn.${operator}(${a}, ${b})`);
  } catch (err) {
    if (err instanceof bn.BigNumberAssertionError) return;
    throw err;
  }
}

describe('utils/assertions/assert-bignumber.ts', function () {
  it('correctly coerces strings and numbers to BigNumber', function () {
    bn.equal(BigNumber.from(12), BigNumber.from(12));
    bn.equal(12, BigNumber.from(12));
    bn.equal('13', BigNumber.from(13));
    bn.equal(12, '12');
  });

  it('#eq', function () {
    bn.equal(12, 12);
    not('equal', 12, 13);
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
    throws(() => bn.isZero(1), bn.BigNumberAssertionError);
    throws(() => bn.isZero(1000), bn.BigNumberAssertionError);
  });

  it('#near', function () {
    bn.near(1, 2, 1);
    bn.near(10000, 9500, 1000);
    throws(() => bn.near(1, 3, 0), bn.BigNumberAssertionError);
    throws(() => bn.near(10000, 20000, 350), bn.BigNumberAssertionError);
  });
});
