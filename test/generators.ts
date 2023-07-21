import crypto from 'crypto';
import { ethers } from 'ethers';
import { wei } from '@synthetixio/wei';

// --- Core Utilities --- //

export const raise = (err: string): never => {
  throw new Error(err);
};

export const bn = (n: number) => wei(n).toBN();
export const isNil = <A>(a: A | undefined | null): boolean => a === undefined || a === null;

export const shuffle = <A>(arr: A[]): A[] => {
  const arr2 = [...arr];
  for (var i = arr2.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr2[i];
    arr2[i] = arr2[j];
    arr2[j] = temp;
  }
  return arr2;
};

export const genSample = <A>(a: A[]): A => a[Math.floor(Math.random() * a.length)];
export const genOption = <A>(f: () => A): A | undefined => (genSample([true, false]) ? f() : undefined);

export const genOneOf = <A>(l: A[]): A => {
  const a = genSample(l);
  return isNil(a) ? raise('oneOf found invalid sequence') : a;
};

export const genListOf = <A>(n: number, f: (n?: number) => A): A[] =>
  n <= 0 ? raise('listOf found invalid n') : genTimes(n, f);

// --- Primitives --- //

export const genTimes = <A>(n: number, f: (n?: number) => A) => [...Array(n).keys()].map(f);
export const genString = (
  n: number,
  choices: string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
) =>
  [...Array(n).keys()].reduce((acc) => {
    acc += choices[Math.floor(Math.random() * choices.length)];
    return acc;
  }, '');
export const genAddress = () => ethers.Wallet.createRandom().address;
export const genMarketName = () => genString(3, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') + 'PERP';
export const genBytes32 = () => ethers.utils.formatBytes32String(crypto.randomBytes(8).toString('hex'));
export const genFloat = (min = 0, max = 1) => Math.random() * (max - min + 1) + min;
export const genInt = (min = 0, max = 1) => Math.floor(genFloat(min, max));

// --- Composition --- //

export const genBootstrap = (nMarkets: number = 1) => ({
  pool: {
    initialCollateralPrice: bn(genInt(100, 10_100)),
  },
  global: {
    minMarginUsd: bn(genInt(50, 100)),
    priceDivergencePercent: wei(genFloat(0.1, 0.3)).toBN(),
    pythPublishTimeMin: 6,
    pythPublishTimeMax: 12,
    minOrderAge: 12,
    maxOrderAge: 60,
    minKeeperFeeUsd: bn(genInt(10, 15)),
    maxKeeperFeeUsd: bn(genInt(50, 100)),
    keeperProfitMarginPercent: wei(genFloat(0.1, 0.2)).toBN(),
    keeperSettlementGasUnits: 1_200_000,
    keeperLiquidationGasUnits: 1_200_000,
    keeperLiquidationFeeUsd: bn(genInt(1, 5)),
  },
  // TODO: Consider not wrapping maxLeverage, maxMarketSize, maxFundingVelocity etc. with bn(...).
  markets: genListOf(nMarkets, () => ({
    name: ethers.utils.formatBytes32String(genMarketName()),
    initialPrice: bn(genInt(100, 1000)),
    specific: {
      oracleNodeId: genBytes32(),
      pythPriceFeedId: genBytes32(),
      skewScale: bn(genInt(100_000, 500_000)),
      makerFee: wei(genFloat(0.0001, 0.0005)).toBN(), // 1 - 5bps
      takerFee: wei(genFloat(0.0006, 0.0008)).toBN(), // 1 - 8bps
      maxLeverage: bn(genInt(10, 100)),
      maxMarketSize: bn(genInt(10_000, 25_000)),
      maxFundingVelocity: bn(genInt(3, 9)),
      liquidationBufferPercent: wei(genFloat(0.005, 0.0075)).toBN(),
      liquidationFeePercent: wei(genFloat(0.0002, 0.0003)).toBN(),
      liquidationPremiumMultiplier: wei(genFloat(1.1, 1.3)).toBN(),
    },
  })),
});
