import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { collateralValue, depositCollateral, discountedValue, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import { SpotMarketProxy } from '@synthetixio/spot-market/test/generated/typechain';

const accountId = 4;
const perpsMarketConfig = [
  {
    requestedMarketId: 25,
    name: 'Bitcoin',
    token: 'BTC',
    price: bn(30_000),
    fundingParams: { skewScale: bn(100), maxFundingVelocity: bn(0) },
    liquidationParams: {
      initialMarginFraction: bn(2),
      minimumInitialMarginRatio: bn(0.01),
      maintenanceMarginScalar: bn(0.5),
      maxLiquidationLimitAccumulationMultiplier: bn(1),
      liquidationRewardRatio: bn(0.05),
      maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
      minimumPositionMargin: bn(1000),
    },
    settlementStrategy: {
      settlementReward: bn(0),
    },
  },
  {
    requestedMarketId: 26,
    name: 'Ether',
    token: 'ETH',
    price: bn(2000),
    fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
    liquidationParams: {
      initialMarginFraction: bn(2),
      minimumInitialMarginRatio: bn(0.01),
      maintenanceMarginScalar: bn(0.5),
      maxLiquidationLimitAccumulationMultiplier: bn(1),
      liquidationRewardRatio: bn(0.05),
      maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
      minimumPositionMargin: bn(500),
    },
    settlementStrategy: {
      settlementReward: bn(0),
    },
  },
];

const btcDiscountConfig = {
  upperLimitDiscount: bn(0.05),
  lowerLimitDiscount: bn(0.01),
  discountScalar: bn(1.5),
  skewScale: bn(100),
};

const ethDiscountConfig = {
  upperLimitDiscount: bn(0.05),
  lowerLimitDiscount: bn(0.01),
  discountScalar: bn(2),
  skewScale: bn(10_000),
};

const synthMarketsConfig = [
  {
    name: 'btc',
    token: 'snxBTC',
    buyPrice: bn(20_000),
    sellPrice: bn(20_000),
    ...btcDiscountConfig,
  },
  {
    name: 'eth',
    token: 'snxETH',
    buyPrice: bn(2_000),
    sellPrice: bn(2_000),
    ...ethDiscountConfig,
  },
];

describe('Account margins - Multicollateral', () => {
  const { systems, provider, perpsMarkets, trader1, trader2, synthMarkets } = bootstrapMarkets({
    synthMarkets: synthMarketsConfig,
    perpsMarkets: perpsMarketConfig,
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

  let btcAmount: Wei,
    ethAmount: Wei,
    btcMarketId: ethers.BigNumber,
    ethMarketId: ethers.BigNumber,
    spotMarket: SpotMarketProxy;

  before('identify', async () => {
    spotMarket = systems().SpotMarket;
    btcMarketId = synthMarkets()[0].marketId();
    ethMarketId = synthMarkets()[1].marketId();
    btcAmount = wei(
      await systems().PerpsMarket.getCollateralAmount(accountId, synthMarkets()[0].marketId())
    );
    ethAmount = wei(
      await systems().PerpsMarket.getCollateralAmount(accountId, synthMarkets()[1].marketId())
    );
  });

  let totalCollateralValue: Wei;
  it('has correct withdrawable margin', async () => {
    const btcValue = await collateralValue(btcAmount, btcMarketId, spotMarket);
    const ethValue = await collateralValue(ethAmount, ethMarketId, spotMarket);
    totalCollateralValue = btcValue.add(ethValue);
    assertBn.equal(
      totalCollateralValue.toBN(),
      await systems().PerpsMarket.getWithdrawableMargin(accountId)
    );
  });

  let availableTradingMargin: Wei;
  it('has correct available trading margin', async () => {
    availableTradingMargin = await discountedValue(
      [
        {
          amount: btcAmount,
          synthId: btcMarketId,
          config: btcDiscountConfig,
        },
        {
          amount: ethAmount,
          synthId: ethMarketId,
          config: ethDiscountConfig,
        },
      ],
      spotMarket
    );

    assertBn.equal(
      await systems().PerpsMarket.getAvailableMargin(accountId),
      availableTradingMargin.toBN()
    );
  });

  describe('open position', () => {
    before(async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: perpsMarkets()[1].marketId(),
        sizeDelta: bn(50),
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: bn(2000),
      });
    });

    let requiredMargin: Wei;

    before('identify required margin', async () => {
      const { requiredInitialMargin } = await systems().PerpsMarket.getRequiredMargins(accountId);

      requiredMargin = wei(requiredInitialMargin);
    });

    it('should have correct available margin', async () => {
      const { totalPnl } = await systems().PerpsMarket.getOpenPosition(
        accountId,
        perpsMarkets()[1].marketId()
      );

      assertBn.equal(
        await systems().PerpsMarket.getWithdrawableMargin(accountId),
        availableTradingMargin.sub(requiredMargin).add(totalPnl).toBN()
      );
    });
  });

  let accruedDebt: ethers.BigNumber;
  describe('close position and accrue debt', () => {
    before('reduce price', async () => {
      await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(1500));
    });

    before('close position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: perpsMarkets()[1].marketId(),
        sizeDelta: bn(-50),
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: bn(1500),
      });
    });

    it('has correct withdrawable margin', async () => {
      accruedDebt = await systems().PerpsMarket.debt(accountId);

      assertBn.equal(
        await systems().PerpsMarket.getWithdrawableMargin(accountId),
        availableTradingMargin.sub(accruedDebt).toBN()
      );

      assertBn.equal(
        await systems().PerpsMarket.getAvailableMargin(accountId),
        availableTradingMargin.sub(accruedDebt).toBN()
      );
    });
  });

  describe('pay off debt', () => {
    before('pay off debt', async () => {
      await systems().PerpsMarket.connect(trader1()).payDebt(accountId, accruedDebt);
    });

    it('has no debt', async () => {
      assertBn.equal(await systems().PerpsMarket.debt(accountId), bn(0));
    });

    it('has correct withdrawable margin', async () => {
      assertBn.equal(
        await systems().PerpsMarket.getWithdrawableMargin(accountId),
        totalCollateralValue.toBN()
      );

      assertBn.equal(
        await systems().PerpsMarket.getAvailableMargin(accountId),
        availableTradingMargin.toBN()
      );
    });
  });
});
