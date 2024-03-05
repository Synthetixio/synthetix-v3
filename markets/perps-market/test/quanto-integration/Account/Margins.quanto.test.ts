import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { openPosition } from '../../integration/helpers';
import {
  ONE_ETHER,
  getQuantoPositionSize,
  getQuantoFillPrice,
  getQuantoPnl,
} from '../../integration/helpers/';
import { ethers } from 'ethers';

describe('Quanto Account margins test', () => {
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
  const btcSkewScale = bn(100).div(2000);
  const ethSkewScale = bn(1000).div(2000);

  // Margin and Funding Parameters
  const maxFundingVelocity = bn(0);
  const initialMarginFraction = bn(2);
  const minimumInitialMarginRatio = bn(0.01);
  const maintenanceMarginScalar = bn(0.5);
  const maxLiquidationLimitAccumulationMultiplier = bn(1);
  const liquidationRewardRatio = bn(0.05);
  const maxSecondsInLiquidationWindow = ethers.BigNumber.from(10);

  // Position Margins
  const btcMinimumPositionMargin = bn(1000).div(2_000);
  const ethMinimumPositionMargin = bn(500).div(2_000);
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
    const usdAmount = initialAccountMargin.div(5); // 100_000 / 5 = 20_000
    const minAmountReceived = initialAccountEthMargin; // 10
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
      .modifyCollateral(accountId, usdMarketId, initialAccountUsdMargin); // 80_000
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
    // Position Sizes (vanilla perp sizes, not quanto adjusted)
    const perpPositionSizeBtcMarket = bn(-2);
    const perpPositionSizeEthMarket = bn(20);

    // Quanto Position Sizes (adjusted for quanto)
    let quantoPositionSizeBtcMarket: ethers.BigNumber;
    let quantoPositionSizeEthMarket: ethers.BigNumber;

    // Position Fill Prices
    let btcFillPrice: ethers.BigNumber;
    let ethFillPrice: ethers.BigNumber;

    // Initial Position Margins
    let btcInitialPositionMargin: ethers.BigNumber;
    let ethInitialPositionMargin: ethers.BigNumber;

    // Liquidation Margins
    let ethLiqMargin: ethers.BigNumber;
    let btcLiqMargin: ethers.BigNumber;

    // Maintenance Margins
    let btcMaintenanceMargin: ethers.BigNumber;
    let ethMaintenanceMargin: ethers.BigNumber;

    // General Position Margins
    let minimumPositionMargin: ethers.BigNumber;

    // Starting Market Skew
    const startingSkew = bn(0);

    // Initial Profit and Loss
    let initialPnl: ethers.BigNumber;

    before('open BTC position', async () => {
      quantoPositionSizeBtcMarket = getQuantoPositionSize({
        sizeInBaseAsset: perpPositionSizeBtcMarket,
        quantoAssetPrice: ethPrice,
      });

      // must record prior to opening position otherwise
      // accurate system state is not achieved
      btcFillPrice = await systems().PerpsMarket.fillPrice(
        bn(btcMarketId).div(ONE_ETHER),
        quantoPositionSizeBtcMarket, // -2
        btcPrice
      );

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: btcMarketIdBn,
        sizeDelta: quantoPositionSizeBtcMarket,
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: btcPrice,
      });
    });

    before('open ETH position', async () => {
      quantoPositionSizeEthMarket = getQuantoPositionSize({
        sizeInBaseAsset: perpPositionSizeEthMarket,
        quantoAssetPrice: ethPrice,
      });

      // must record prior to opening position otherwise
      // accurate system state is not achieved
      ethFillPrice = await systems().PerpsMarket.fillPrice(
        bn(ethMarketId).div(ONE_ETHER),
        quantoPositionSizeEthMarket,
        ethPrice
      );

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: ethMarketIdBn,
        sizeDelta: quantoPositionSizeEthMarket,
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: ethPrice,
      });
    });

    it('btc position has correct fill price', async () => {
      const expectedBtcFillPrice = getQuantoFillPrice({
        skew: startingSkew,
        skewScale: perpsMarketConfig[0].fundingParams.skewScale,
        size: quantoPositionSizeBtcMarket,
        price: btcPrice,
      });

      assertBn.equal(expectedBtcFillPrice, btcFillPrice);
    });

    it('eth position has correct fill price', async () => {
      const expectedEthFillPrice = getQuantoFillPrice({
        skew: startingSkew,
        skewScale: perpsMarketConfig[1].fundingParams.skewScale,
        size: quantoPositionSizeEthMarket,
        price: ethPrice,
      });

      assertBn.equal(expectedEthFillPrice, ethFillPrice);
    });

    before('identify expected values', () => {
      const btcSkewScale = perpsMarketConfig[0].fundingParams.skewScale;
      const ethSkewScale = perpsMarketConfig[1].fundingParams.skewScale;

      const btcPnl = getQuantoPnl({
        baseAssetStartPrice: btcFillPrice,
        baseAssetEndPrice: btcPrice,
        quantoAssetStartPrice: ethPrice,
        quantoAssetEndPrice: ethPrice,
        baseAssetSize: quantoPositionSizeBtcMarket,
      });
      const ethPnl = getQuantoPnl({
        baseAssetStartPrice: ethFillPrice,
        baseAssetEndPrice: ethPrice,
        quantoAssetStartPrice: ethPrice,
        quantoAssetEndPrice: ethPrice,
        baseAssetSize: quantoPositionSizeEthMarket,
      });

      initialPnl = btcPnl.add(ethPnl).mul(ethPrice).div(ONE_ETHER);

      const absNotionalBtcValue = quantoPositionSizeBtcMarket.mul(btcPrice).div(ONE_ETHER).abs();
      const absNotionalEthValue = quantoPositionSizeEthMarket.mul(ethPrice).div(ONE_ETHER).abs();

      const btcInitialMarginRatio = quantoPositionSizeBtcMarket
        .abs()
        .mul(ONE_ETHER)
        .div(btcSkewScale)
        .mul(initialMarginFraction)
        .div(ONE_ETHER)
        .add(minimumInitialMarginRatio);

      const ethInitialMarginRatio = quantoPositionSizeEthMarket
        .abs()
        .mul(ONE_ETHER)
        .div(ethSkewScale)
        .mul(initialMarginFraction)
        .div(ONE_ETHER)
        .add(minimumInitialMarginRatio);

      btcInitialPositionMargin = absNotionalBtcValue.mul(btcInitialMarginRatio).div(ONE_ETHER);
      ethInitialPositionMargin = absNotionalEthValue.mul(ethInitialMarginRatio).div(ONE_ETHER);

      btcLiqMargin = absNotionalBtcValue.mul(liquidationRewardRatio).div(ONE_ETHER);
      ethLiqMargin = absNotionalEthValue.mul(liquidationRewardRatio).div(ONE_ETHER);

      btcMaintenanceMargin = btcInitialPositionMargin.mul(maintenanceMarginScalar).div(ONE_ETHER);
      ethMaintenanceMargin = ethInitialPositionMargin.mul(maintenanceMarginScalar).div(ONE_ETHER);

      minimumPositionMargin = btcMinimumPositionMargin.add(ethMinimumPositionMargin);
    });

    it('has correct available margin', async () => {
      assertBn.equal(
        initialAccountMargin.add(initialPnl),
        await systems().PerpsMarket.getAvailableMargin(accountId)
      );
    });

    it('has correct withdrawable margin', async () => {
      const expectedWithdrawableMargin = initialAccountMargin
        .add(initialPnl)
        .sub(btcInitialPositionMargin.mul(ethPrice).div(ONE_ETHER))
        .sub(ethInitialPositionMargin.mul(ethPrice).div(ONE_ETHER))
        .sub(ethLiqMargin.mul(ethPrice).div(ONE_ETHER))
        .sub(btcLiqMargin.mul(ethPrice).div(ONE_ETHER))
        .sub(minimumPositionMargin.mul(ethPrice).div(ONE_ETHER));

      assertBn.equal(
        expectedWithdrawableMargin,
        await systems().PerpsMarket.getWithdrawableMargin(accountId)
      );
    });

    it('has correct initial margin', async () => {
      const [initialMargin, , maxLiquidationReward] =
        await systems().PerpsMarket.getRequiredMargins(accountId);

      const expectedInitialMargin = btcInitialPositionMargin.mul(ethPrice).div(ONE_ETHER)
        .add(ethInitialPositionMargin.mul(ethPrice).div(ONE_ETHER))
        .add(minimumPositionMargin.mul(ethPrice).div(ONE_ETHER));

      assertBn.equal(expectedInitialMargin, initialMargin.sub(maxLiquidationReward));
    });

    it('has correct maintenance margin', async () => {
      const [, maintenanceMargin, maxLiquidationReward] =
        await systems().PerpsMarket.getRequiredMargins(accountId);

      const expectedMaintenanceMargin = btcMaintenanceMargin.mul(ethPrice).div(ONE_ETHER)
        .add(ethMaintenanceMargin.mul(ethPrice).div(ONE_ETHER))
        .add(minimumPositionMargin.mul(ethPrice).div(ONE_ETHER));

      assertBn.equal(expectedMaintenanceMargin, maintenanceMargin.sub(maxLiquidationReward));
    });

    it('has correct open interest', async () => {
      const btcOiAbs = perpPositionSizeBtcMarket.mul(btcPrice).div(ONE_ETHER).abs();
      const ethOiAbs = perpPositionSizeEthMarket.mul(ethPrice).div(ONE_ETHER).abs();
      const expectedOi = btcOiAbs.add(ethOiAbs);

      assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(accountId), expectedOi);
    });
  });
});
