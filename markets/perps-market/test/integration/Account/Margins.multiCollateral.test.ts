import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { depositCollateral, discountedValue, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

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

const ETH_SYNTH_PRICE = bn(2000),
  BTC_SYNTH_PRICE = bn(30_000);

const synthMarketsConfig = [
  {
    name: 'btc',
    token: 'snxBTC',
    buyPrice: BTC_SYNTH_PRICE,
    sellPrice: BTC_SYNTH_PRICE,
    ...btcDiscountConfig,
  },
  {
    name: 'eth',
    token: 'snxETH',
    buyPrice: ETH_SYNTH_PRICE,
    sellPrice: ETH_SYNTH_PRICE,
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
          snxUSDAmount: () => bn(200_000),
        },
        {
          synthMarket: () => synthMarkets()[1],
          snxUSDAmount: () => bn(20_000),
        },
      ],
    });
  });

  let btcAmount: Wei, ethAmount: Wei, btcMarketId: ethers.BigNumber;

  before('identify', async () => {
    btcAmount = wei(
      await systems().PerpsMarket.getCollateralAmount(accountId, synthMarkets()[0].marketId())
    );
    ethAmount = wei(
      await systems().PerpsMarket.getCollateralAmount(accountId, synthMarkets()[1].marketId())
    );
  });

  let totalCollateralValue: Wei;
  it('has correct withdrawable margin', async () => {
    const btcValue = btcAmount.mul(wei(BTC_SYNTH_PRICE));
    const ethValue = ethAmount.mul(wei(ETH_SYNTH_PRICE));
    totalCollateralValue = btcValue.add(ethValue);
    assertBn.equal(
      totalCollateralValue.toBN(),
      await systems().PerpsMarket.getWithdrawableMargin(accountId)
    );
  });

  it("doesn't allow you to withdraw more than you put in", async () => {
    await assertRevert(
      systems().PerpsMarket.connect(trader1()).modifyCollateral(accountId, btcMarketId, bn(-13)),
      `InsufficientSynthCollateral(${btcMarketId}, ${btcAmount.toString(18, true)}, ${bn(13)})`
    );
  });

  let availableTradingMargin: Wei;
  it('has correct available trading margin', async () => {
    availableTradingMargin = await discountedValue([
      {
        amount: btcAmount,
        price: wei(BTC_SYNTH_PRICE),
        config: btcDiscountConfig,
      },
      {
        amount: ethAmount,
        price: wei(ETH_SYNTH_PRICE),
        config: ethDiscountConfig,
      },
    ]);

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

    let expectedWithdrawableMargin: Wei;
    it('should have correct available margin', async () => {
      const { totalPnl } = await systems().PerpsMarket.getOpenPosition(
        accountId,
        perpsMarkets()[1].marketId()
      );

      expectedWithdrawableMargin = availableTradingMargin.sub(requiredMargin).add(totalPnl);

      assertBn.equal(
        await systems().PerpsMarket.getWithdrawableMargin(accountId),
        expectedWithdrawableMargin.toBN()
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
