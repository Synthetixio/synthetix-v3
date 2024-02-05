import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { openPosition } from '../../integration/helpers';
import Wei, { wei } from '@synthetixio/wei';
import { calculatePricePnl } from '../../integration/helpers/fillPrice';
import { ethers } from 'ethers';

describe.only('Account margins test', () => {
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
      quanto: {
        name: 'Ether',
        token: 'ETH',
        price: bn(2_000),
        quantoSynthMarketIndex: 0,
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
      quanto: {
        name: 'Ether',
        token: 'ETH',
        price: bn(2_000),
        quantoSynthMarketIndex: 0,
      },
    },
  ];

  const spotMarketConfig = [
    {
      name: 'Ether',
      token: 'snxETH',
      buyPrice: bn(2000),
      sellPrice: bn(2000),
    },
  ];

  const { systems, provider, trader1, perpsMarkets, synthMarkets } = bootstrapMarkets({
    synthMarkets: spotMarketConfig,
    perpsMarkets: perpsMarketConfig,
    traderAccountIds: [accountId, 5],
    liquidationGuards: {
      minLiquidationReward: bn(0),
      minKeeperProfitRatioD18: bn(0),
      maxLiquidationReward: bn(10_000),
      maxKeeperScalingRatioD18: bn(1),
    },
  });

  before('buy sETH via spot market', async () => {
    const ethSpotMarketId = synthMarkets()[0].marketId();
    const usdAmount = bn(20_000);
    const minAmountReceived = bn(10);
    const referrer = ethers.constants.AddressZero;

    await systems()
      .SpotMarket.connect(trader1())
      .buy(ethSpotMarketId, usdAmount, minAmountReceived, referrer);
  });

  before('add some sETH collateral to margin', async () => {
    const ethSpotMarketId = synthMarkets()[0].marketId();

    await synthMarkets()[0]
      .synth()
      .connect(trader1())
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);

    await systems()
      .PerpsMarket.connect(trader1())
      .modifyCollateral(accountId, ethSpotMarketId, bn(10));
  });

  before('add some sUSD collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(accountId, 0, bn(100_000));
  });

  describe('before open positions', () => {
    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(accountId), bn(120_000));
    });

    it('has correct withdrawable margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getWithdrawableMargin(accountId), bn(120_000));
    });

    it('has correct initial and maintenance margin', async () => {
      const [initialMargin, maintenanceMargin] =
        await systems().PerpsMarket.getRequiredMargins(accountId);
      assertBn.equal(initialMargin, 0);
      assertBn.equal(maintenanceMargin, 0);
    });
  });

  describe('after open positions', () => {
    before('open 2 positions', async () => {
      // await openPosition({
      //   systems,
      //   provider,
      //   trader: trader1(),
      //   accountId,
      //   keeper: trader1(),
      //   marketId: perpsMarkets()[0].marketId(),
      //   sizeDelta: bn(-2),
      //   settlementStrategyId: perpsMarkets()[0].strategyId(),
      //   price: bn(30_000),
      // });

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: perpsMarkets()[1].marketId(),
        sizeDelta: bn(20),
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: bn(2_000),
      });
    });

    let startingMargin: Wei,
      initialPnl: Wei,
      btcInitialMargin: Wei,
      ethInitialMargin: Wei,
      ethLiqMargin: Wei,
      btcLiqMargin: Wei,
      btcMaintenanceMargin: Wei,
      ethMaintenanceMargin: Wei,
      minimumPositionMargin: Wei;

    before('identify expected values', () => {
      startingMargin = wei(120_000);

      const btcSkewScale = wei(perpsMarketConfig[0].fundingParams.skewScale);
      const ethSkewScale = wei(perpsMarketConfig[1].fundingParams.skewScale);

      const btcPnl = calculatePricePnl(wei(0), btcSkewScale, wei(-2), wei(30_000));
      const ethPnl = calculatePricePnl(wei(0), ethSkewScale, wei(20), wei(2000));

      initialPnl = btcPnl.add(ethPnl);

      const notionalBtcValue = wei(2).mul(wei(30_000));
      const notionalEthValue = wei(20).mul(wei(2000));

      const btcInitialMarginRatio = wei(2).div(wei(btcSkewScale)).mul(wei(2)).add(wei(0.01));
      const ethInitialMarginRatio = wei(20).div(wei(ethSkewScale)).mul(wei(2)).add(wei(0.01));

      btcInitialMargin = notionalBtcValue.mul(btcInitialMarginRatio);
      ethInitialMargin = notionalEthValue.mul(ethInitialMarginRatio);

      btcLiqMargin = notionalBtcValue.mul(0.05);
      ethLiqMargin = notionalEthValue.mul(0.05);

      // maintenance margin ratio == 1
      btcMaintenanceMargin = btcInitialMargin.mul(wei(0.5));
      ethMaintenanceMargin = ethInitialMargin.mul(wei(0.5));

      // in above config: 1000 + 500
      minimumPositionMargin = wei(1500);
    });

    it.only('has correct available margin', async () => {
      // 🚨 available margin should NOT be negative 680000000000000000000000
      assertBn.equal(
        await systems().PerpsMarket.getAvailableMargin(accountId), // -680000000000000000000000
        startingMargin.add(initialPnl).toBN() // 119000000000000000000000
      );
    });

    it('has correct withdrawable margin', async () => {
      assertBn.equal(
        await systems().PerpsMarket.getWithdrawableMargin(accountId),
        startingMargin
          .add(initialPnl)
          .sub(btcInitialMargin)
          .sub(ethInitialMargin)
          .sub(ethLiqMargin)
          .sub(btcLiqMargin)
          .sub(minimumPositionMargin)
          .toBN()
      );
    });

    it('has correct initial and maintenance margin', async () => {
      const [initialMargin, maintenanceMargin, maxLiquidationReward] =
        await systems().PerpsMarket.getRequiredMargins(accountId);
      assertBn.equal(
        initialMargin.sub(maxLiquidationReward),
        btcInitialMargin.add(ethInitialMargin).add(minimumPositionMargin).toBN()
      );
      assertBn.equal(
        maintenanceMargin.sub(maxLiquidationReward),
        btcMaintenanceMargin.add(ethMaintenanceMargin).add(minimumPositionMargin).toBN()
      );
    });
  });
});
