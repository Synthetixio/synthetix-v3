import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { calculateFillPrice, computeFees, depositCollateral, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

const accountId = 4;

const synthMarketsConfig = [
  {
    name: 'btc',
    token: 'snxBTC',
    buyPrice: bn(20_000),
    sellPrice: bn(20_000),
  },
  {
    name: 'eth',
    token: 'snxETH',
    buyPrice: bn(2_000),
    sellPrice: bn(2_000),
  },
];

const orderFees = {
  makerFee: wei(0.0003), // 3bps
  takerFee: wei(0.0008), // 8bps
};

const ethPerpsMarketId = bn(26);

describe('Account Debt', () => {
  const { systems, provider, perpsMarkets, trader1, trader2, synthMarkets } = bootstrapMarkets({
    synthMarkets: synthMarketsConfig,
    perpsMarkets: [
      {
        requestedMarketId: ethPerpsMarketId,
        name: 'Ether',
        token: 'ETH',
        price: bn(2000),
        fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
        orderFees: {
          makerFee: orderFees.makerFee.toBN(),
          takerFee: orderFees.takerFee.toBN(),
        },
        liquidationParams: {
          initialMarginFraction: bn(2),
          minimumInitialMarginRatio: bn(0.01),
          maintenanceMarginScalar: bn(0.5),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: bn(0.05),
          maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
          minimumPositionMargin: bn(500),
        },
      },
    ],
    traderAccountIds: [accountId, 5],
    liquidationGuards: {
      minLiquidationReward: bn(0),
      minKeeperProfitRatioD18: bn(0),
      maxLiquidationReward: bn(10_000),
      maxKeeperScalingRatioD18: bn(1),
    },
  });

  before('deposit some snxETH and snxBTC', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => accountId,
      collaterals: [
        {
          synthMarket: () => synthMarkets()[0],
          snxUSDAmount: () => bn(240_000),
        },
        {
          synthMarket: () => synthMarkets()[1],
          snxUSDAmount: () => bn(1_400_000),
        },
      ],
    });

    await depositCollateral({
      systems,
      trader: trader2,
      accountId: () => 5,
      collaterals: [
        {
          synthMarket: () => synthMarkets()[0],
          snxUSDAmount: () => bn(16_000),
        },
        {
          synthMarket: () => synthMarkets()[1],
          snxUSDAmount: () => bn(20_000),
        },
      ],
    });
  });

  const openAndClosePosition = (size: Wei, startingPrice: Wei, endingPrice: Wei) => {
    before(`open position size ${size.toString()}`, async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(startingPrice.toBN());

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: ethPerpsMarketId,
        sizeDelta: size.toBN(),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: startingPrice.toBN(),
      });
    });

    before('close position', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(endingPrice.toBN());

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: ethPerpsMarketId,
        sizeDelta: size.mul(-1).toBN(),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: endingPrice.toBN(),
      });
    });

    const initialFillPrice = calculateFillPrice(wei(0), wei(1000), size, startingPrice);
    const finalFillPrice = calculateFillPrice(size, wei(1000), size.mul(-1), endingPrice);

    return {
      openOrderFee: computeFees(wei(0), wei(50), initialFillPrice, orderFees),
      closeOrderFee: computeFees(wei(50), wei(-50), finalFillPrice, orderFees),
      pnl: finalFillPrice.sub(initialFillPrice).mul(size),
    };
  };

  let currentDebt: Wei;
  describe('negative pnl', () => {
    const { pnl: expectedPnl } = openAndClosePosition(wei(50), wei(2000), wei(1500));

    it('accrues correct amount of debt', async () => {
      currentDebt = expectedPnl;
      assertBn.equal(currentDebt.abs().toBN(), await systems().PerpsMarket.debt(accountId));
    });
  });

  describe('positive pnl to lower debt', () => {
    const { pnl: expectedPnl } = openAndClosePosition(wei(50), wei(1500), wei(1750));

    it('reduces debt', async () => {
      currentDebt = currentDebt.add(expectedPnl);
      assertBn.equal(currentDebt.abs().toBN(), await systems().PerpsMarket.debt(accountId));
    });
  });

  describe('positive pnl to eliminate debt and add snxUSD', () => {
    const { pnl: expectedPnl, closeOrderFee } = openAndClosePosition(wei(50), wei(1750), wei(2250));

    it('sets debt to 0', async () => {
      assertBn.equal(0, await systems().PerpsMarket.debt(accountId));
    });

    it('sets snxUSD to leftover profit', async () => {
      currentDebt = currentDebt.add(expectedPnl).sub(closeOrderFee.totalFees);
      assertBn.equal(
        currentDebt.toBN(),
        await systems().PerpsMarket.getCollateralAmount(accountId, 0)
      );
    });
  });

  describe('negative pnl reduces snxUSD', () => {
    const {
      pnl: expectedPnl,
      openOrderFee,
      closeOrderFee,
    } = openAndClosePosition(wei(50), wei(2250), wei(2150));

    it('debt is still 0', async () => {
      assertBn.equal(0, await systems().PerpsMarket.debt(accountId));
    });

    it('reduces snxUSD amount', async () => {
      currentDebt = currentDebt
        .add(expectedPnl)
        .sub(openOrderFee.totalFees)
        .sub(closeOrderFee.totalFees);
      assertBn.equal(
        currentDebt.abs().toBN(),
        await systems().PerpsMarket.getCollateralAmount(accountId, 0)
      );
    });
  });

  describe('negative pnl adds debt', () => {
    const { pnl: expectedPnl, openOrderFee } = openAndClosePosition(wei(50), wei(2150), wei(1800));

    it('adds debt', async () => {
      currentDebt = currentDebt.add(expectedPnl).sub(openOrderFee.totalFees);
      assertBn.equal(currentDebt.abs().toBN(), await systems().PerpsMarket.debt(accountId));
    });

    it('reduces snxUSD to 0', async () => {
      assertBn.equal(0, await systems().PerpsMarket.getCollateralAmount(accountId, 0));
    });
  });
});
