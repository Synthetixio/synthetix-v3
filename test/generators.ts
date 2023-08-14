import crypto from 'crypto';
import { BigNumber, ethers } from 'ethers';
import { wei } from '@synthetixio/wei';
import { MARKETS } from './data/markets.fixture';
import { bn, isNil, raise, shuffle } from './utils';
import type { bootstrap } from './bootstrap';

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
export const genFloat = (min = 0, max = 1) => Math.random() * (max - min + 1) + min;
export const genInt = (min = 0, max = 1) => Math.floor(genFloat(min, max));

// --- Composition --- //
//
// All subsequent composition generators (post genBootstrap) will add onto the prior state from
// `bootstrap` to generate valid inputs to be used during tests. There are exceptions such as
// `genMarket` which doesn't necessarily depend on existing state and might be used for isolated cases.

export const genBootstrap = () => ({
  initialEthPrice: bn(genInt(1900, 2500)),
  pool: {
    initialCollateralPrice: bn(genInt(100, 10_000)),
  },
  global: {
    priceDivergencePercent: wei(genFloat(0.1, 0.3)).toBN(),
    pythPublishTimeMin: 8,
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
  markets: shuffle(MARKETS),
});

/**
 * Generates a market with possibly unrealistic parms. Use `genOneOf(MARKETS)` for realistic values.
 */
export const genMarket = () => ({
  name: ethers.utils.formatBytes32String(genMarketName()),
  initialPrice: bn(genInt(1, 10_000)),
  specific: {
    oracleNodeId: genBytes32(),
    pythPriceFeedId: genBytes32(),
    makerFee: wei(genFloat(0.0001, 0.0005)).toBN(), // 1 - 5bps
    takerFee: wei(genFloat(0.0006, 0.0008)).toBN(), // 1 - 8bps
    maxMarketSize: bn(genInt(20_000, 50_000)),
    maxFundingVelocity: bn(genInt(3, 9)),
    minMarginUsd: bn(genInt(50, 60)),
    minCreditPercent: bn(genFloat(1, 1.1)),
    skewScale: bn(genInt(100_000, 500_000)),
    minMarginRatio: bn(genFloat(0.01, 0.02)),
    incrementalMarginScalar: bn(genFloat(0.04, 0.06)),
    maintenanceMarginScalar: bn(0.5), // MMS is half of IMR'
    liquidationRewardPercent: wei(genFloat(0.005, 0.0075)).toBN(),
    liquidationLimitScalar: bn(genFloat(0.9, 1.2)),
    liquidationWindowDuration: bn(genOneOf([36, 48, 60])),
  },
});

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

// --- Higher level generators --- //

type Bs = ReturnType<typeof bootstrap>;
type Collateral = ReturnType<Bs['collaterals']>[number];
type Market = ReturnType<Bs['markets']>[number];

export const genTrader = async (bs: Bs) => {
  const { traders, markets, collaterals } = bs;

  // Randomly select a trader to operate on.
  const trader = genOneOf(traders());

  // Randomly select a market and collateral as margin to trade with.
  const market = genOneOf(markets());
  const collateral = genOneOf(collaterals());

  // Randomly provide test collateral to trader.
  const marginUsdDepositAmount = wei(genOneOf([1000, 5000, 10_000, 20_000, 40_000, 100_000]));
  const { answer: collateralPrice } = await collateral.aggregator().latestRoundData();
  const collateralDepositAmount = marginUsdDepositAmount.div(collateralPrice).toBN();

  return {
    trader,
    traderAddress: await trader.signer.getAddress(),
    market,
    marketId: market.marketId(),
    collateral,
    collateralDepositAmount,
    marginUsdDepositAmount,
  };
};

export const genKeeperOrderBufferFeeUsd = () => bn(genFloat(2, 10));

export const genOrder = async (
  bs: Bs,
  market: Market,
  collateral: Collateral,
  collateralDepositAmount: BigNumber,
  options?: { desiredLeverage: number }
) => {
  const { systems } = bs;
  const { PerpMarketProxy } = systems();

  const keeperOrderBufferFeeUsd = genKeeperOrderBufferFeeUsd();
  const { answer: collateralPrice } = await collateral.aggregator().latestRoundData();
  const marginUsd = wei(collateralDepositAmount).mul(collateralPrice).sub(keeperOrderBufferFeeUsd);
  const oraclePrice = await PerpMarketProxy.getOraclePrice(market.marketId());

  // Use a reasonble amount of leverage
  const leverage = options?.desiredLeverage ?? genOneOf([0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // Randomly use long/short.
  let sizeDelta = marginUsd.div(oraclePrice).mul(wei(leverage)).toBN();
  sizeDelta = genOneOf([sizeDelta, sizeDelta.mul(-1)]);

  const limitPrice = genLimitPrice(sizeDelta, oraclePrice);
  const fillPrice = await PerpMarketProxy.getFillPrice(market.marketId(), sizeDelta);
  const fees = await PerpMarketProxy.getOrderFees(market.marketId(), sizeDelta, keeperOrderBufferFeeUsd);

  return {
    keeperOrderBufferFeeUsd,
    marginUsd: marginUsd.toBN(),
    leverage,
    sizeDelta,
    limitPrice,
    fillPrice,
    oraclePrice,
    orderFee: fees.orderFee,
    keeperFee: fees.keeperFee,
  };
};
