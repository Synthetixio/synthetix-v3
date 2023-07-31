import crypto from 'crypto';
import { BigNumber, ethers } from 'ethers';
import Wei, { wei } from '@synthetixio/wei';
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
          maxLeverage: bn(genOneOf([10, 15, 20, 25, 30, 50, 100])),
          maxMarketSize: bn(genInt(20_000, 50_000)),
          maxFundingVelocity: bn(genInt(3, 9)),
          initialMarginRatio: bn(genFloat(0.04, 0.06)),
          maintenanceMarginRatio: bn(genFloat(0.01, 0.03)),
          liquidationRewardPercent: wei(genFloat(0.005, 0.0075)).toBN(),
        },
      };
      return market;
    }),
  };
  return bs;
};

/**
 * Generate a limit price 1 - 5% within the oracle price. The limit will be higher (long) or lower (short).
 */
export const genLimitPrice = (sizeDelta: BigNumber, oraclePrice: BigNumber) =>
  sizeDelta.lt(0)
    ? wei(oraclePrice)
        .mul(1 + genFloat(-0.01, -0.05))
        .toBN()
    : wei(oraclePrice)
        .mul(1 + genFloat(0.01, 0.05))
        .toBN();

export const genOrder = async (
  proxy: PerpMarketProxy,
  marketId: BigNumber,
  depositAmountUsd: BigNumber,
  desiredLeverage?: Partial<{ min: number; max: number }>
) => {
  // TODO: Compute a local keeperFeeBufferUsd rather than randomly generating.
  const keeperFeeBufferUsd = bn(genInt(1, 5));

  // TODO: Accept accountId to generate a valid order given an existing position.

  const { maxMarketSize, maxLeverage } = await proxy.getMarketConfigurationById(marketId);
  const oraclePrice = await proxy.getOraclePrice(marketId);

  // Assuming `depositAmountUsd` is at or below maxLeverage, this may already be at maxLeverage.
  const depositSize = wei(depositAmountUsd).div(oraclePrice);

  const rMinLeverage = desiredLeverage?.min ?? 0.5;
  const rMaxLeverage = desiredLeverage?.max ?? wei(maxLeverage).toNumber();

  if (rMinLeverage > rMaxLeverage) {
    return raise(`minLeverage (${rMinLeverage}) > maxLeverage (${rMaxLeverage})`);
  }

  // Ensure generated sizeDelta is below maxMarketSize to be considered valid. Do this _only_ if
  // desiredLeverage has _not_ been specified. When specified, it means we want to cause a case to occur.
  const leverage = genFloat(rMinLeverage, rMaxLeverage);
  const sizeDeltaWei = desiredLeverage
    ? depositSize.mul(leverage)
    : Wei.min(depositSize.mul(leverage), wei(maxMarketSize));
  const sizeDeltaBn = genOneOf([sizeDeltaWei.mul(-1), sizeDeltaWei]).toBN();

  return {
    sizeDelta: sizeDeltaBn,
    limitPrice: genLimitPrice(sizeDeltaBn, oraclePrice),
    leverage,
    keeperFeeBufferUsd,
  };
};
