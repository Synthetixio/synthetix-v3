import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { openPosition } from '../../integration/helpers';
import {
  getQuantoPositionSize,
  getQuantoPnlWithSkew,
  getQuantoFillPrice,
  ONE_ETHER,
} from '../../integration/helpers/';
import { ethers } from 'ethers';

describe.only('Account margins test', () => {
  // Account and Market Identifiers
  const accountId = 4;
  const usdMarketId = 0;
  const btcMarketId = 25;
  const btcMarketIdBn = bn(btcMarketId).div(ONE_ETHER);
  const ethMarketId = 26;
  const ethMarketIdBn = bn(ethMarketId).div(ONE_ETHER);
  const quantoSynthMarketIndex = 0;

  // Market Prices
  const btcPrice = bn(30_000);
  const ethPrice = bn(2_000);

  // Skew Scales
  const btcSkewScale = bn(100);
  const ethSkewScale = bn(1000);

  // Margin and Funding Parameters
  const maxFundingVelocity = bn(0);
  const initialMarginFraction = bn(2);
  const minimumInitialMarginRatio = bn(0.01);
  const maintenanceMarginScalar = bn(0.5);
  const maxLiquidationLimitAccumulationMultiplier = bn(1);
  const liquidationRewardRatio = bn(0.05);
  const maxSecondsInLiquidationWindow = ethers.BigNumber.from(10);

  // Position Margins
  const btcMinimumPositionMargin = bn(1000);
  const ethMinimumPositionMargin = bn(500);
  const initialAccountMargin = bn(100_000);
  const initialAccountEthMargin = bn(10);
  const initialAccountUsdMargin = bn(80_000);

  // Liquidation Parameters
  const settlementReward = bn(0);
  const minLiquidationReward = bn(0);
  const minKeeperProfitRatioD18 = bn(0);
  const maxLiquidationReward = bn(10_000);
  const maxKeeperScalingRatioD18 = bn(1);

  // Perps Market Config
  const perpsMarketConfig = [
    {
      requestedMarketId: btcMarketId,
      name: 'Bitcoin',
      token: 'BTC',
      price: btcPrice,
      fundingParams: { skewScale: btcSkewScale, maxFundingVelocity: maxFundingVelocity },
      liquidationParams: {
        initialMarginFraction: initialMarginFraction,
        minimumInitialMarginRatio: minimumInitialMarginRatio,
        maintenanceMarginScalar: maintenanceMarginScalar,
        maxLiquidationLimitAccumulationMultiplier: maxLiquidationLimitAccumulationMultiplier,
        liquidationRewardRatio: liquidationRewardRatio,
        maxSecondsInLiquidationWindow: maxSecondsInLiquidationWindow,
        minimumPositionMargin: btcMinimumPositionMargin,
      },
      settlementStrategy: {
        settlementReward: settlementReward,
      },
      quanto: {
        name: 'Ether',
        token: 'ETH',
        price: ethPrice,
        quantoSynthMarketIndex: quantoSynthMarketIndex,
      },
    },
    {
      requestedMarketId: ethMarketId,
      name: 'Ether',
      token: 'ETH',
      price: ethPrice,
      fundingParams: { skewScale: ethSkewScale, maxFundingVelocity: maxFundingVelocity },
      liquidationParams: {
        initialMarginFraction: initialMarginFraction,
        minimumInitialMarginRatio: minimumInitialMarginRatio,
        maintenanceMarginScalar: maintenanceMarginScalar,
        maxLiquidationLimitAccumulationMultiplier: maxLiquidationLimitAccumulationMultiplier,
        liquidationRewardRatio: liquidationRewardRatio,
        maxSecondsInLiquidationWindow: maxSecondsInLiquidationWindow,
        minimumPositionMargin: ethMinimumPositionMargin,
      },
      settlementStrategy: {
        settlementReward: settlementReward,
      },
      quanto: {
        name: 'Ether',
        token: 'ETH',
        price: ethPrice,
        quantoSynthMarketIndex: quantoSynthMarketIndex,
      },
    },
  ];

  // Spot Market Config
  const spotMarketConfig = [
    {
      name: 'Ether',
      token: 'snxETH',
      buyPrice: ethPrice,
      sellPrice: ethPrice,
    },
  ];

  // Bootstrap Markets, Systems, and Accounts
  const { systems, provider, trader1, perpsMarkets, synthMarkets } = bootstrapMarkets({
    synthMarkets: spotMarketConfig,
    perpsMarkets: perpsMarketConfig,
    traderAccountIds: [accountId],
    liquidationGuards: {
      minLiquidationReward: minLiquidationReward,
      minKeeperProfitRatioD18: minKeeperProfitRatioD18,
      maxLiquidationReward: maxLiquidationReward,
      maxKeeperScalingRatioD18: maxKeeperScalingRatioD18,
    },
  });

  before('buy sETH via spot market', async () => {
    const ethSpotMarketId = synthMarkets()[0].marketId();
    const usdAmount = initialAccountMargin.div(5);
    const minAmountReceived = initialAccountEthMargin;
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
      .modifyCollateral(accountId, ethSpotMarketId, initialAccountEthMargin);
  });

  before('add some sUSD collateral to margin', async () => {
    await systems()
      .PerpsMarket.connect(trader1())
      .modifyCollateral(accountId, usdMarketId, initialAccountUsdMargin);
  });

  describe('before open positions', () => {
    it('has correct available margin', async () => {
      assertBn.equal(
        await systems().PerpsMarket.getAvailableMargin(accountId),
        initialAccountMargin
      );
    });

    it('has correct withdrawable margin', async () => {
      assertBn.equal(
        await systems().PerpsMarket.getWithdrawableMargin(accountId),
        initialAccountMargin
      );
    });

    it('has correct initial and maintenance margin', async () => {
      const [initialMargin, maintenanceMargin] =
        await systems().PerpsMarket.getRequiredMargins(accountId);
      assertBn.isZero(initialMargin);
      assertBn.isZero(maintenanceMargin);
    });
  });

  describe('after open positions', () => {
    // Initial Position Sizes
    const btcInitialPositionSize = bn(-2);
    const ethInitialPositionSize = bn(20);

    // Initial Position Margins
    let btcInitialPositionMargin: ethers.BigNumber;
    let ethInitialPositionMargin: ethers.BigNumber;

    // Starting Market Skew
    const startingSkew = bn(0);

    // Order Sizes
    let orderSizeBtcMarket: ethers.BigNumber;
    let orderSizeEthMarket: ethers.BigNumber;

    // Initial Profit and Loss
    let initialPnl: ethers.BigNumber;

    // Liquidation Margins
    let ethLiqMargin: ethers.BigNumber;
    let btcLiqMargin: ethers.BigNumber;

    // Maintenance Margins
    let btcMaintenanceMargin: ethers.BigNumber;
    let ethMaintenanceMargin: ethers.BigNumber;

    // General Position Margins
    let minimumPositionMargin: ethers.BigNumber;

    before('open 2 positions', async () => {
      orderSizeBtcMarket = getQuantoPositionSize({
        sizeInBaseAsset: btcInitialPositionSize,
        quantoAssetPrice: btcPrice,
      });

      orderSizeEthMarket = getQuantoPositionSize({
        sizeInBaseAsset: ethInitialPositionSize,
        quantoAssetPrice: ethPrice,
      });

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: btcMarketIdBn,
        sizeDelta: orderSizeBtcMarket,
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: btcPrice,
      });

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: ethMarketIdBn,
        sizeDelta: orderSizeEthMarket,
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: ethPrice,
      });
    });

    before('identify expected values', () => {
      const btcSkewScale = perpsMarketConfig[0].fundingParams.skewScale;
      const ethSkewScale = perpsMarketConfig[1].fundingParams.skewScale;

      const btcPnl = getQuantoPnlWithSkew({
        baseAssetStartPrice: btcPrice,
        baseAssetSizeDelta: orderSizeBtcMarket,
        startingSkew: startingSkew,
        skewScale: btcSkewScale,
      });

      const ethPnl = getQuantoPnlWithSkew({
        baseAssetStartPrice: ethPrice,
        baseAssetSizeDelta: orderSizeEthMarket,
        startingSkew: startingSkew,
        skewScale: ethSkewScale,
      });

      initialPnl = btcPnl.add(ethPnl);

      const notionalBtcValue = btcInitialPositionSize.mul(btcPrice).div(ONE_ETHER);
      const notionalEthValue = ethInitialPositionSize.mul(ethPrice).div(ONE_ETHER);

      const btcInitialMarginRatio = btcInitialPositionSize
        .div(btcSkewScale)
        .mul(initialMarginFraction)
        .add(minimumInitialMarginRatio);
      const ethInitialMarginRatio = ethInitialPositionSize
        .div(ethSkewScale)
        .mul(initialMarginFraction)
        .add(minimumInitialMarginRatio);

      btcInitialPositionMargin = notionalBtcValue.mul(btcInitialMarginRatio).div(ONE_ETHER);
      ethInitialPositionMargin = notionalEthValue.mul(ethInitialMarginRatio).div(ONE_ETHER);

      btcLiqMargin = notionalBtcValue.mul(liquidationRewardRatio).div(ONE_ETHER);
      ethLiqMargin = notionalEthValue.mul(liquidationRewardRatio).div(ONE_ETHER);

      // maintenance margin ratio == 1
      // 🚨 where is it set to "1"? minimumInitialMarginRatio is set to bn(0.01);
      btcMaintenanceMargin = btcInitialPositionMargin.mul(maintenanceMarginScalar).div(ONE_ETHER);
      ethMaintenanceMargin = ethInitialPositionMargin.mul(maintenanceMarginScalar).div(ONE_ETHER);

      minimumPositionMargin = btcMinimumPositionMargin.add(ethMinimumPositionMargin);
    });

    it('btc position has correct fill price', async () => {
      const actualBtcFillPrice = await systems().PerpsMarket.fillPrice(
        bn(btcMarketId).div(ONE_ETHER),
        btcInitialPositionSize,
        btcPrice
      );

      const expectedBtcFillPrice = getQuantoFillPrice({
        skew: startingSkew,
        skewScale: perpsMarketConfig[0].fundingParams.skewScale,
        size: btcInitialPositionSize,
        price: btcPrice,
      });

      // 🚨 expected and actual fill price precision loss
      // 29700000000000000000000 -> expected
      // 29699980000000000020000 -> actual
      assertBn.equal(expectedBtcFillPrice, actualBtcFillPrice);
    });

    it('eth position has correct fill price', async () => {
      const actualEthFillPrice = await systems().PerpsMarket.fillPrice(
        bn(ethMarketId).div(ONE_ETHER),
        ethInitialPositionSize,
        ethPrice
      );

      const expectedEthFillPrice = getQuantoFillPrice({
        skew: startingSkew,
        skewScale: perpsMarketConfig[1].fundingParams.skewScale,
        size: ethInitialPositionSize,
        price: ethPrice,
      });

      // 🚨 expected and actual fill price precision loss
      // 2020000000000000000000 -> expected
      // 2020020000000000000000 -> actual
      assertBn.equal(expectedEthFillPrice, actualEthFillPrice);
    });

    it('has correct available margin', async () => {
      // 🚨 expected and actual available margin precision loss
      // 99999999899333333333335 -> expected
      // 99999798666666666670000 -> actual
      assertBn.equal(
        initialAccountMargin.add(initialPnl),
        await systems().PerpsMarket.getAvailableMargin(accountId)
      );
    });

    it('has correct withdrawable margin', async () => {
      const expectedWithdrawableMargin = initialAccountMargin
        .add(initialPnl)
        .sub(btcInitialPositionMargin)
        .sub(ethInitialPositionMargin)
        .sub(ethLiqMargin)
        .sub(btcLiqMargin)
        .sub(minimumPositionMargin);

      // 🚨 expected and actual withdrawable margin precision loss
      // 99699999899333333333335 -> expected
      // 98498478264000000004537 -> actual
      assertBn.equal(
        expectedWithdrawableMargin,
        await systems().PerpsMarket.getWithdrawableMargin(accountId)
      );
    });

    it('has correct initial margin', async () => {
      const [initialMargin, , maxLiquidationReward] =
        await systems().PerpsMarket.getRequiredMargins(accountId);

      const expectedInitialMargin = btcInitialPositionMargin
        .add(ethInitialPositionMargin)
        .add(minimumPositionMargin);

      // 🚨 expected and actual initial margin calculation error
      // 1300000000000000000000 -> expected
      // 1500220402666666666463 -> actual
      assertBn.equal(expectedInitialMargin, initialMargin.sub(maxLiquidationReward));
    });

    it('has correct maintenance margin', async () => {
      const [, maintenanceMargin, maxLiquidationReward] =
        await systems().PerpsMarket.getRequiredMargins(accountId);

      const expectedMaintenanceMargin = btcMaintenanceMargin
        .add(ethMaintenanceMargin)
        .add(minimumPositionMargin);

      // 🚨 expected and actual maintenance margin calculation error
      // 1400000000000000000000 -> expected
      // 1500110201333333333231 -> actual
      assertBn.equal(expectedMaintenanceMargin, maintenanceMargin.sub(maxLiquidationReward));
    });
  });
});
