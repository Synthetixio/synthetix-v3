import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { calculateFillPrice, depositCollateral, discountedValue, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

const accountId = 4;
const perpsMarketConfig = [
  {
    requestedMarketId: 25,
    name: 'Bitcoin',
    token: 'BTC',
    price: bn(20_000),
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
];

const btcDiscountConfig = {
  upperLimitDiscount: bn(0.05),
  lowerLimitDiscount: bn(0.01),
  discountScalar: bn(1.5),
  skewScale: bn(100),
};

const SYNTH_BTC_PRICE = bn(20_000);

const synthMarketsConfig = [
  {
    name: 'btc',
    token: 'snxBTC',
    buyPrice: SYNTH_BTC_PRICE,
    sellPrice: SYNTH_BTC_PRICE,
    ...btcDiscountConfig,
  },
];

describe('Account margins - Multicollateral - InsufficientCollateralAvailableForWithdraw', () => {
  const { systems, provider, perpsMarkets, trader1, synthMarkets } = bootstrapMarkets({
    synthMarkets: synthMarketsConfig,
    perpsMarkets: perpsMarketConfig,
    traderAccountIds: [accountId],
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
      ],
    });
  });

  let btcAmount: Wei, btcMarketId: ethers.BigNumber;

  before('identify', async () => {
    btcMarketId = synthMarkets()[0].marketId();
    btcAmount = wei(
      await systems().PerpsMarket.getCollateralAmount(accountId, synthMarkets()[0].marketId())
    );
  });

  let availableTradingMargin: Wei;
  it('has correct available trading margin', async () => {
    availableTradingMargin = await discountedValue([
      {
        amount: btcAmount,
        config: btcDiscountConfig,
        price: wei(SYNTH_BTC_PRICE),
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
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(10),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: bn(20000),
      });
    });

    let requiredMargin: Wei;

    before('identify required margin', async () => {
      const { requiredInitialMargin } = await systems().PerpsMarket.getRequiredMargins(accountId);

      requiredMargin = wei(requiredInitialMargin);
    });

    let expectedWithdrawableMargin: Wei;
    it('should have correct withdrawable margin', async () => {
      const { totalPnl } = await systems().PerpsMarket.getOpenPosition(
        accountId,
        perpsMarkets()[0].marketId()
      );
      expectedWithdrawableMargin = availableTradingMargin.sub(requiredMargin).add(totalPnl);

      assertBn.equal(
        await systems().PerpsMarket.getWithdrawableMargin(accountId),
        expectedWithdrawableMargin.toBN()
      );
    });

    it('reverts when attempting to withdraw more than available', async () => {
      const amountToWithdraw = expectedWithdrawableMargin.add(wei(1));
      const btcToWithdraw = amountToWithdraw.div(SYNTH_BTC_PRICE).toBN();

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountId, btcMarketId, btcToWithdraw.mul(-1)),
        'InsufficientCollateralAvailableForWithdraw'
      );
    });
  });

  describe('close position, accruing debt', () => {
    let pnl: Wei;

    before(async () => {
      const initialFillPrice = calculateFillPrice(wei(0), wei(100), wei(10), wei(20000));
      const finalFillPrice = calculateFillPrice(wei(10), wei(100), wei(-10), wei(19500));
      pnl = finalFillPrice.sub(initialFillPrice).mul(wei(10));
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(19500));

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(-10),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: bn(19500),
      });
    });

    it('cannot withdraw due to debt', async () => {
      assertBn.equal(await systems().PerpsMarket.getWithdrawableMargin(accountId), 0);
      assertBn.equal(await systems().PerpsMarket.debt(accountId), pnl.abs().toBN());
    });
  });
});
