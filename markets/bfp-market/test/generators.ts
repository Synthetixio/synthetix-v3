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

export function* toRoundRobinGenerators<A>(l: A[]): Generator<A, A> {
  let idx = 0;
  while (true) {
    yield l[idx];
    idx = (idx + 1) % l.length;
  }
}

// --- Gen Utils --- //

export const genTimes = <A>(n: number, f: (n?: number) => A) => [...Array(n).keys()].map(f);

export const genOneOf = <A>(l: A[]): A => {
  const a = shuffle(l)[0];
  return isNil(a) ? raise('oneOf found invalid sequence') : a;
};

export const genOption = <A>(f: () => A): A | undefined =>
  genOneOf([true, false]) ? f() : undefined;

export const genListOf = <A>(n: number, f: (n?: number) => A): A[] =>
  n <= 0 ? raise('listOf found invalid n') : genTimes(n, f);

export const genSubListOf = <A>(l: A[], n: number): A[] =>
  l.length < n ? raise('subListOf found n > l.length') : shuffle(l).slice(0, n);

// --- Primitive generators --- //

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
export const genBytes32 = () =>
  ethers.utils.formatBytes32String(crypto.randomBytes(8).toString('hex'));
export const genNumber = (min = 0, max = 1) => random(min, max);
export const genBoolean = () => genOneOf([true, false]);

// --- Composition --- //
//
// All subsequent composition generators (post genBootstrap) will add onto the prior state from
// `bootstrap` to generate valid inputs to be used during tests. There are exceptions such as
// `genMarket` which doesn't necessarily depend on existing state and might be used for isolated cases.

export const genBootstrap = () => ({
  initialEthPrice: bn(genNumber(1900, 2500)),
  global: {
    pythPublishTimeMin: 12,
    pythPublishTimeMax: 60,
    minOrderAge: 12,
    maxOrderAge: 60,
    minKeeperFeeUsd: bn(genNumber(10, 15)),
    maxKeeperFeeUsd: bn(genNumber(300, 500)),
    keeperProfitMarginUsd: bn(genNumber(5, 20)),
    keeperProfitMarginPercent: bn(genNumber(0.1, 0.2)),
    keeperSettlementGasUnits: 1_200_000,
    keeperCancellationGasUnits: 600_000,
    keeperFlagGasUnits: 1_200_000,
    keeperLiquidateMarginGasUnits: 1_200_000,
    keeperLiquidationGasUnits: 1_200_000,
    keeperLiquidationFeeUsd: bn(genNumber(1, 5)),
    keeperLiquidationEndorsed: genAddress(), // Temporary dummy address to be reconfigurd later.
    collateralDiscountScalar: bn(1),
    minCollateralDiscount: bn(0.01),
    maxCollateralDiscount: bn(0.05),
    sellExactInMaxSlippagePercent: bn(genNumber(0.03, 0.05)),
    utilizationBreakpointPercent: bn(genNumber(0.65, 0.85)),
    lowUtilizationSlopePercent: bn(genNumber(0.0002, 0.0003)),
    highUtilizationSlopePercent: bn(genNumber(0.005, 0.015)),
    hooks: {
      maxHooksPerOrder: genNumber(3, 5),
    },
  },
  markets: MARKETS,
});

/**
 * Generates a market with possibly unrealistic parms. Use `genOneOf(MARKETS)` for realistic values.
 *
 * NOTE: BE WARNED! THIS FUNCTION CAN RESULT IN UNEXPECTED BEHAVIOUR IN DOWNSTREAM TESTS.
 */
export const genMarket = () => ({
  name: ethers.utils.formatBytes32String(genMarketName()),
  initialPrice: bn(genNumber(1, 10_000)),
  specific: {
    oracleNodeId: genBytes32(),
    pythPriceFeedId: genBytes32(),
    makerFee: bn(genNumber(0.0001, 0.0005)), // 1 - 5bps
    takerFee: bn(genNumber(0.0006, 0.0008)), // 1 - 8bps
    maxMarketSize: bn(genNumber(20_000, 50_000)),
    maxFundingVelocity: bn(genNumber(3, 9)),
    minMarginUsd: bn(genNumber(500, 600)),
    minCreditPercent: bn(genNumber(1, 1.1)),
    skewScale: bn(genNumber(100_000, 500_000)),
    fundingVelocityClamp: bn(genNumber(0.000001, 0.00001)),
    minMarginRatio: bn(genNumber(0.01, 0.02)),
    incrementalMarginScalar: bn(genNumber(0.04, 0.06)),
    maintenanceMarginScalar: bn(0.5), // MMS is half of IMR'
    maxInitialMarginRatio: bn(0.9),
    liquidationRewardPercent: bn(genNumber(0.005, 0.0075)),
    liquidationLimitScalar: bn(genNumber(0.9, 1.2)),
    liquidationWindowDuration: genOneOf([36, 48, 60]), // In seconds
    liquidationMaxPd: bn(genNumber(0.0001, 0.001)),
  },
});

/**
 * Generate a limit price 5 - 10% within the oracle price. The limit will be higher (long) or lower (short).
 */
export const genLimitPrice = (
  isLong: boolean,
  oraclePrice: BigNumber,
  options?: { desiredPriceImpactPercentage?: number }
) => {
  const priceImpactPercentage = options?.desiredPriceImpactPercentage ?? genNumber(0.05, 0.1);
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
    : wei(genOneOf([2000, 5000, 10_000, 15_000]));
  const collateralPrice = await collateral.getPrice();
  const collateralDepositAmount = marginUsdDepositAmount.div(collateralPrice).toBN();

  return {
    trader,
    traderAddress: await trader.signer.getAddress(),
    market,
    marketId: market.marketId(),
    collateral,
    collateralDepositAmount,
    marginUsdDepositAmount: marginUsdDepositAmount.toBN(),
    collateralPrice,
  };
};

/** Generates a side randomly, 1 for long, -1 for short. */
export const genSide = (): 1 | -1 => genOneOf([1, -1]);

/** Generates a valid order to settle on a specific market for a specific collateral type/amount. */
export const genOrder = async (
  { systems }: Bs,
  market: Market,
  collateral: Collateral,
  collateralDepositAmount: BigNumber,
  options?: {
    desiredLeverage?: number;
    desiredSide?: 1 | -1;
    desiredKeeperFeeBufferUsd?: number;
    desiredSize?: BigNumber; // Note if desiredSize is specified, desiredSide and leverage will be ignored.
    desiredPriceImpactPercentage?: number;
    desiredHooks?: string[];
  }
) => {
  const { BfpMarketProxy } = systems();

  const keeperFeeBufferUsd = !isNil(options?.desiredKeeperFeeBufferUsd)
    ? wei(options?.desiredKeeperFeeBufferUsd).toBN()
    : genKeeperFeeBufferUsd();

  // Use a reasonable amount of leverage.
  let leverage = options?.desiredLeverage ?? genOneOf([0.5, 1, 2, 3, 4, 5]);

  const collateralPrice = await collateral.getPrice();
  const marginUsd = wei(collateralDepositAmount).mul(collateralPrice).sub(keeperFeeBufferUsd);

  const oraclePrice = await BfpMarketProxy.getOraclePrice(market.marketId());
  let sizeDelta = marginUsd.div(oraclePrice).mul(wei(leverage)).toBN();

  // `desiredSide` is specified, just use that.
  if (options?.desiredSize) {
    sizeDelta = options.desiredSize;
    // If size is set, make sure we return the correct leverage.
    leverage = wei(sizeDelta).mul(oraclePrice).div(marginUsd).toNumber();
  } else if (options?.desiredSide) {
    sizeDelta = sizeDelta.mul(options.desiredSide);
  } else {
    sizeDelta = sizeDelta.mul(genSide());
  }

  const limitPrice = genLimitPrice(sizeDelta.gt(0), oraclePrice, {
    desiredPriceImpactPercentage: options?.desiredPriceImpactPercentage,
  });
  const fillPrice = await BfpMarketProxy.getFillPrice(market.marketId(), sizeDelta);
  const { orderFee, keeperFee } = await BfpMarketProxy.getOrderFees(
    market.marketId(),
    sizeDelta,
    keeperFeeBufferUsd
  );

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
    hooks: options?.desiredHooks ?? [],
  };
};

/** Generates an order (possibly invalid) based on sizeDelta and the market. */
export const genOrderFromSizeDelta = async (
  { systems }: Bs,
  market: Market,
  sizeDelta: BigNumber,
  options?: {
    desiredKeeperFeeBufferUsd?: number;
    desiredPriceImpactPercentage?: number;
  }
): ReturnType<typeof genOrder> => {
  const { BfpMarketProxy } = systems();

  const keeperFeeBufferUsd = !isNil(options?.desiredKeeperFeeBufferUsd)
    ? wei(options?.desiredKeeperFeeBufferUsd).toBN()
    : genKeeperFeeBufferUsd();

  const oraclePrice = await BfpMarketProxy.getOraclePrice(market.marketId());
  const limitPrice = genLimitPrice(sizeDelta.gt(0), oraclePrice, {
    desiredPriceImpactPercentage: options?.desiredPriceImpactPercentage,
  });
  const fillPrice = await BfpMarketProxy.getFillPrice(market.marketId(), sizeDelta);
  const { orderFee, keeperFee } = await BfpMarketProxy.getOrderFees(
    market.marketId(),
    sizeDelta,
    keeperFeeBufferUsd
  );

  return {
    marginUsd: bn(0),
    leverage: 0,
    keeperFeeBufferUsd,
    sizeDelta,
    limitPrice,
    fillPrice,
    oraclePrice,
    orderFee,
    keeperFee,
    hooks: [] as string[],
  };
};
