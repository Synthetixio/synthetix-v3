import crypto from 'crypto';
import { BigNumber, ethers } from 'ethers';
import { shuffle, isNil, random } from 'lodash';
import { wei } from '@synthetixio/wei';
import { MARKETS } from './data/markets.fixture';
import { Bs, Market, Trader, Collateral } from './typed';

// --- Utils --- //

export const raise = (err: string): never => {
  throw new Error(err);
};

export const bn = (n: number) => wei(n).toBN();

// --- Primitive generators --- //

export const genTimes = <A>(n: number, f: (n?: number) => A) => [...Array(n).keys()].map(f);

export const genOneOf = <A>(l: A[]): A => {
  const a = shuffle(l)[0];
  return isNil(a) ? raise('oneOf found invalid sequence') : a;
};

export const genOption = <A>(f: () => A): A | undefined => (genOneOf([true, false]) ? f() : undefined);

export const genListOf = <A>(n: number, f: (n?: number) => A): A[] =>
  n <= 0 ? raise('listOf found invalid n') : genTimes(n, f);

// --- Primitives --- //

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
export const genNumber = (min = 0, max = 1) => random(min, max);

// --- Composition --- //
//
// All subsequent composition generators (post genBootstrap) will add onto the prior state from
// `bootstrap` to generate valid inputs to be used during tests. There are exceptions such as
// `genMarket` which doesn't necessarily depend on existing state and might be used for isolated cases.

export const genBootstrap = () => ({
  initialEthPrice: bn(genNumber(1900, 2500)),
  pool: {
    // 50M USD of staked collateral.
    stakedCollateralPrice: bn(100),
    stakedAmount: bn(500_000),
  },
  global: {
    priceDivergencePercent: wei(genNumber(0.1, 0.3)).toBN(),
    pythPublishTimeMin: 8,
    pythPublishTimeMax: 12,
    minOrderAge: 12,
    maxOrderAge: 60,
    minKeeperFeeUsd: bn(genNumber(10, 15)),
    maxKeeperFeeUsd: bn(genNumber(50, 100)),
    keeperProfitMarginPercent: wei(genNumber(0.1, 0.2)).toBN(),
    keeperSettlementGasUnits: 1_200_000,
    keeperLiquidationGasUnits: 1_200_000,
    keeperLiquidationFeeUsd: bn(genNumber(1, 5)),
  },
  markets: shuffle(MARKETS),
});

/**
 * Generates a market with possibly unrealistic parms. Use `genOneOf(MARKETS)` for realistic values.
 */
export const genMarket = () => ({
  name: ethers.utils.formatBytes32String(genMarketName()),
  initialPrice: bn(genNumber(1, 10_000)),
  specific: {
    oracleNodeId: genBytes32(),
    pythPriceFeedId: genBytes32(),
    makerFee: wei(genNumber(0.0001, 0.0005)).toBN(), // 1 - 5bps
    takerFee: wei(genNumber(0.0006, 0.0008)).toBN(), // 1 - 8bps
    maxMarketSize: bn(genNumber(20_000, 50_000)),
    maxFundingVelocity: bn(genNumber(3, 9)),
    minMarginUsd: bn(genNumber(50, 60)),
    minCreditPercent: bn(genNumber(1, 1.1)),
    skewScale: bn(genNumber(100_000, 500_000)),
    minMarginRatio: bn(genNumber(0.01, 0.02)),
    incrementalMarginScalar: bn(genNumber(0.04, 0.06)),
    maintenanceMarginScalar: bn(0.5), // MMS is half of IMR'
    liquidationRewardPercent: wei(genNumber(0.005, 0.0075)).toBN(),
    liquidationLimitScalar: bn(genNumber(0.9, 1.2)),
    liquidationWindowDuration: bn(genOneOf([36, 48, 60])),
  },
});

/**
 * Generate a limit price 5 - 10% within the oracle price. The limit will be higher (long) or lower (short).
 */
export const genLimitPrice = (isLong: boolean, oraclePrice: BigNumber) => {
  const priceImpactPercentage = genNumber(0.05, 0.1);
  const limitPrice = isLong
    ? wei(oraclePrice).mul(1 + priceImpactPercentage)
    : wei(oraclePrice).mul(1 - priceImpactPercentage);
  return limitPrice.toBN();
};

export const genKeeperFeeBufferUsd = () => bn(genNumber(2, 10));

// --- Higher level generators --- //

/** Generates a trade context composed of a trader, market to operate on, and collateral as margin. */
export const genTrader = async (
  bs: Bs,
  options?: {
    desiredTrader?: Trader;
    desiredMarket?: Market;
    desiredCollateral?: Collateral;
    desiredMarginUsdDepositAmount?: number;
  }
) => {
  const { traders, markets, collaterals } = bs;

  // Randomly select trader, market, and collateral to operate on, overriding with desired options provided.
  const trader = options?.desiredTrader ?? genOneOf(traders());
  const market = options?.desiredMarket ?? genOneOf(markets());
  const collateral = options?.desiredCollateral ?? genOneOf(collaterals());

  // Randomly provide test collateral to trader.
  const marginUsdDepositAmount = !isNil(options?.desiredMarginUsdDepositAmount)
    ? wei(options?.desiredMarginUsdDepositAmount)
    : wei(genOneOf([1000, 5000, 10_000, 15_000]));
  const { answer: collateralPrice } = await collateral.aggregator().latestRoundData();
  const collateralDepositAmount = marginUsdDepositAmount.div(collateralPrice).toBN();

  return {
    trader,
    traderAddress: await trader.signer.getAddress(),
    market,
    marketId: market.marketId(),
    collateral,
    collateralDepositAmount,
    marginUsdDepositAmount: marginUsdDepositAmount.toBN(),
  };
};

/** Generates a valid order to settle on a specific market for a specific collateral type/amount. */
export const genOrder = async (
  { systems }: Bs,
  market: Market,
  collateral: Collateral,
  collateralDepositAmount: BigNumber,
  options?: { desiredLeverage?: number; desiredSide?: 1 | -1; desiredKeeperFeeBufferUsd?: number }
) => {
  const { PerpMarketProxy } = systems();

  const keeperFeeBufferUsd = !isNil(options?.desiredKeeperFeeBufferUsd)
    ? wei(options?.desiredKeeperFeeBufferUsd).toBN()
    : genKeeperFeeBufferUsd();

  // Use a reasonble amount of leverage
  const leverage = options?.desiredLeverage ?? genOneOf([0.5, 1, 2, 3, 4, 5]);

  const { answer: collateralPrice } = await collateral.aggregator().latestRoundData();
  const marginUsd = wei(collateralDepositAmount).mul(collateralPrice).sub(keeperFeeBufferUsd);

  // Randomly use long/short unless `desiredSide` is specified.
  const oraclePrice = await PerpMarketProxy.getOraclePrice(market.marketId());
  let sizeDelta = marginUsd.div(oraclePrice).mul(wei(leverage)).toBN();
  if (options?.desiredSide) {
    sizeDelta = sizeDelta.mul(options.desiredSide);
  } else {
    sizeDelta = genOneOf([sizeDelta, sizeDelta.mul(-1)]);
  }

  const limitPrice = genLimitPrice(sizeDelta.gt(0), oraclePrice);
  const fillPrice = await PerpMarketProxy.getFillPrice(market.marketId(), sizeDelta);
  const { orderFee, keeperFee } = await PerpMarketProxy.getOrderFees(market.marketId(), sizeDelta, keeperFeeBufferUsd);

  return {
    keeperFeeBufferUsd,
    marginUsd: marginUsd.toBN(),
    leverage,
    sizeDelta,
    limitPrice,
    fillPrice,
    oraclePrice,
    orderFee,
    keeperFee,
  };
};
