import crypto from 'crypto';
import { BigNumber, ethers } from 'ethers';
import { wei } from '@synthetixio/wei';
import { PerpMarketProxy } from './generated/typechain';

// --- Core Utilities --- //

export const raise = (err: string): never => {
  throw new Error(err);
};

export const bn = (n: number) => wei(n).toBN();

export const isNil = <A>(a: A | undefined | null): boolean => a === undefined || a === null;

export const shuffle = <A>(arr: A[]): A[] => {
  const arr2 = [...arr];
  for (let i = arr2.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr2[i];
    arr2[i] = arr2[j];
    arr2[j] = temp;
  }
  return arr2;
};

export const genOneOf = <A>(l: A[]): A => {
  const a = shuffle(l)[0];
  return isNil(a) ? raise('oneOf found invalid sequence') : a;
};

export const genOption = <A>(f: () => A): A | undefined => (genOneOf([true, false]) ? f() : undefined);

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

export const genBootstrap = (nMarkets: number = 1) => {
  const bs = {
    pool: {
      initialCollateralPrice: bn(genInt(100, 10_000)),
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
    markets: genListOf(nMarkets, () => {
      const market = {
        name: ethers.utils.formatBytes32String(genMarketName()),
        initialPrice: bn(genInt(1, 1000)),
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
      };
      return market;
    }),
  };
  return bs;
};

export const genOrder = async (
  proxy: PerpMarketProxy,
  marketId: BigNumber,
  depositAmountUsd: BigNumber,
  leverage?: Partial<{ min: number; max: number }>
) => {
  // TODO: Compute a local keeperFeeBufferUsd rather than randomly generating.
  const keeperFeeBufferUsd = bn(genInt(1, 5));

  // TODO: Accept accountId to generate a valid order given an existing position.

  const { minMarginUsd } = await proxy.getMarketParameters();
  const { maxLeverage } = await proxy.getMarketParametersById(marketId);
  const oraclePrice = await proxy.getOraclePrice(marketId);
  const sizeDelta1xLeverage = wei(depositAmountUsd.sub(keeperFeeBufferUsd).sub(minMarginUsd)).div(oraclePrice);

  const desiredMinLeverage = leverage?.min ?? 0.5;
  const desiredMaxLeverage = leverage?.max ?? wei(maxLeverage).toNumber();

  if (desiredMaxLeverage < desiredMinLeverage) {
    raise(`minLeverage (${desiredMinLeverage}) > maxLeverage (${desiredMaxLeverage})`);
  }

  const desiredLeverage = genFloat(desiredMinLeverage, desiredMaxLeverage);
  const sizeDelta = genOneOf([
    sizeDelta1xLeverage.mul(desiredLeverage),
    sizeDelta1xLeverage.mul(desiredLeverage).mul(-1),
  ]);

  // Set a limit price that is between 1-5% within the oracle price.
  //
  // This limitPrice will depend on whether position is long or short. A long position would limit with a higher price
  // whereas a short would limit on a lower price.
  const limitPrice = sizeDelta.lt(0)
    ? wei(oraclePrice)
        .mul(1 + genFloat(-0.01, -0.05))
        .toBN()
    : wei(oraclePrice)
        .mul(1 + genFloat(0.01, 0.05))
        .toBN();

  return { sizeDelta: sizeDelta.toBN(), limitPrice, leverage, keeperFeeBufferUsd };
};
