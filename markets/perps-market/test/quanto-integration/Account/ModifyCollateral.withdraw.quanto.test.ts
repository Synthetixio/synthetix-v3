import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { wei } from '@synthetixio/wei';
import {
  OpenPositionData,
  openPosition,
  ONE_ETHER,
  getQuantoPositionSize,
  getQuantoPnl,
} from '../../integration/helpers';

describe.only('ModifyCollateral Withdraw', () => {
  // Account and Market Identifiers
  const accountIds = [10, 20];
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
  const btcMinimumPositionMargin = bn(1000);
  const ethMinimumPositionMargin = bn(500);
  const marginAmount = wei(30_000);
  const depositAmount = wei(1);
  const withdrawAmount = wei(0.1);

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
      name: 'Bitcoin',
      token: 'snxBTC',
      buyPrice: btcPrice,
      sellPrice: btcPrice,
    },
    {
      name: 'Ether',
      token: 'snxETH',
      buyPrice: ethPrice,
      sellPrice: ethPrice,
    },
  ];

  // Bootstrap Markets, Systems, and Accounts
  const { systems, owner, provider, trader1, trader2, superMarketId, perpsMarkets, synthMarkets } =
    bootstrapMarkets({
      synthMarkets: spotMarketConfig,
      perpsMarkets: perpsMarketConfig,
      traderAccountIds: accountIds,
      liquidationGuards: {
        minLiquidationReward: minLiquidationReward,
        minKeeperProfitRatioD18: minKeeperProfitRatioD18,
        maxLiquidationReward: maxLiquidationReward,
        maxKeeperScalingRatioD18: maxKeeperScalingRatioD18,
      },
    });

  let synthBTCMarketId: ethers.BigNumber;
  let synthETHMarketId: ethers.BigNumber;

  before('identify actors', () => {
    synthBTCMarketId = synthMarkets()[0].marketId();
    synthETHMarketId = synthMarkets()[1].marketId();
  });

  const restoreToSetup = snapshotCheckpoint(provider);

  describe('withdraw without open position modifyCollateral() from another account', () => {
    before(restoreToSetup);

    before('owner sets limits to max', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthBTCMarketId, ethers.constants.MaxUint256);
    });

    before('trader1 buys 1 snxBTC', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthBTCMarketId, marginAmount.toBN(), ONE_ETHER, ethers.constants.AddressZero);
    });

    before('trader1 approves the perps market', async () => {
      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, depositAmount.toBN());
    });

    before('trader1 deposits collateral', async () => {
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthBTCMarketId, depositAmount.toBN());
    });

    before('trader2 deposits snxUSD as collateral', async () => {
      await systems()
        .PerpsMarket.connect(trader2())
        .modifyCollateral(accountIds[1], usdMarketId, depositAmount.toBN());
    });

    it('reverts when trader1 tries to withdraw snxUSD', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], usdMarketId, withdrawAmount.mul(-1).toBN()),
        `InsufficientSynthCollateral("${usdMarketId}", "0", "${withdrawAmount.toBN()}")`
      );
    });

    it('reverts when trader2 tries to withdraw snxBTC', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader2())
          .modifyCollateral(accountIds[1], synthBTCMarketId, withdrawAmount.mul(-1).toBN()),
        `InsufficientSynthCollateral("${synthBTCMarketId}", "0", "${withdrawAmount.toBN()}")`
      );
    });
  });

  describe('withdraw without open position modifyCollateral()', () => {
    let spotBalanceBefore: ethers.BigNumber;
    let modifyCollateralWithdrawTxn: ethers.providers.TransactionResponse;

    before(restoreToSetup);

    before('owner sets limits to max', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthBTCMarketId, ethers.constants.MaxUint256);
    });

    before('trader1 buys 1 snxBTC', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthBTCMarketId, marginAmount.toBN(), ONE_ETHER, ethers.constants.AddressZero);
    });

    before('record balances', async () => {
      spotBalanceBefore = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(await trader1().getAddress());
    });

    before('trader1 approves the perps market', async () => {
      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, depositAmount.toBN());
    });

    before('trader1 deposits collateral', async () => {
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthBTCMarketId, depositAmount.toBN());
    });

    before('trader1 withdraws some collateral', async () => {
      modifyCollateralWithdrawTxn = await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthBTCMarketId, withdrawAmount.mul(-1).toBN());
    });

    it('properly reflects the total collateral value', async () => {
      const totalValue = await systems().PerpsMarket.totalCollateralValue(accountIds[0]);
      assertBn.equal(totalValue, depositAmount.sub(withdrawAmount).mul(btcPrice).toBN());
    });

    it('properly reflects trader1 spot balance', async () => {
      const spotBalanceAfter = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(await trader1().getAddress());
      assertBn.equal(
        spotBalanceAfter,
        wei(spotBalanceBefore).sub(depositAmount).add(withdrawAmount).toBN()
      );
    });

    it('properly reflects core system collateral balance', async () => {
      const btcCollateralValue = await systems().Core.getMarketCollateralAmount(
        superMarketId(),
        synthMarkets()[0].synthAddress()
      );

      assertBn.equal(btcCollateralValue, depositAmount.sub(withdrawAmount).toBN());
    });

    it('emits correct event with the expected values', async () => {
      await assertEvent(
        modifyCollateralWithdrawTxn,
        `CollateralModified(${accountIds[0]}, ${synthBTCMarketId}, ${withdrawAmount
          .mul(-1)
          .toBN()}, "${await trader1().getAddress()}"`,
        systems().PerpsMarket
      );
    });
  });

  describe('withdraw with open positions', () => {
    // Account and Market Identifiers
    const accountId = accountIds[0];

    // Position Margins
    const initialAccountMargin = bn(100_000);
    const initialAccountEthMargin = bn(10);
    const initialAccountUsdMargin = bn(80_000);

    // Position Sizes (vanilla perp sizes, not quanto adjusted)
    const perpPositionSizeBtcMarket = bn(-2);
    const perpPositionSizeEthMarket = bn(20);

    // Quanto Position Sizes (adjusted for quanto)
    let quantoPositionSizeBtcMarket: ethers.BigNumber;
    let quantoPositionSizeEthMarket: ethers.BigNumber;

    // Position Fill Prices
    let btcFillPrice: ethers.BigNumber;
    let ethFillPrice: ethers.BigNumber;

    // Initial Profit and Loss
    let initialPnl: ethers.BigNumber;

    before('buy sETH via spot market', async () => {
      const usdAmount = initialAccountMargin.div(5);
      const minAmountReceived = initialAccountEthMargin;
      const referrer = ethers.constants.AddressZero;

      await synthMarkets()[1]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);

      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthETHMarketId, usdAmount, minAmountReceived, referrer);
    });

    before('add some sETH collateral to margin', async () => {
      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);

      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountId, synthETHMarketId, initialAccountEthMargin);
    });

    before('add some sUSD collateral to margin', async () => {
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountId, usdMarketId, initialAccountUsdMargin);
    });

    before('open BTC position', async () => {
      quantoPositionSizeBtcMarket = getQuantoPositionSize({
        sizeInBaseAsset: perpPositionSizeBtcMarket,
        quantoAssetPrice: ethPrice,
      });

      // must record prior to opening position otherwise
      // accurate system state is not achieved
      btcFillPrice = await systems().PerpsMarket.fillPrice(
        bn(btcMarketId).div(ONE_ETHER),
        quantoPositionSizeBtcMarket,
        btcPrice
      );

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: accountId,
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
        accountId: accountId,
        keeper: trader1(),
        marketId: ethMarketIdBn,
        sizeDelta: quantoPositionSizeEthMarket,
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: ethPrice,
      });
    });

    describe('allow withdraw when its less than collateral available for withdraw', () => {
      const restore = snapshotCheckpoint(provider);
      let initialMarginReq: ethers.BigNumber;

      before('withdraw allowed amount', async () => {
        [initialMarginReq] = await systems()
          .PerpsMarket.connect(trader1())
          .getRequiredMargins(accountId);

        const btcPnl = getQuantoPnl({
          baseAssetStartPrice: btcFillPrice,
          baseAssetEndPrice: btcPrice,
          quantoAssetStartPrice: ethPrice,
          quantoAssetEndPrice: ethPrice,
          quantoSizeDelta: quantoPositionSizeBtcMarket,
        });

        const ethPnl = getQuantoPnl({
          baseAssetStartPrice: ethFillPrice,
          baseAssetEndPrice: ethPrice,
          quantoAssetStartPrice: ethPrice,
          quantoAssetEndPrice: ethPrice,
          quantoSizeDelta: quantoPositionSizeEthMarket,
        });

        // initialPnl is denominated in quanto asset (snxETH)
        initialPnl = btcPnl.add(ethPnl).mul(ethPrice).div(ONE_ETHER);

        const withdrawAmt = initialAccountMargin
          .add(initialPnl.mul(ethPrice).div(ONE_ETHER))
          .sub(initialMarginReq)
          .mul(-1);

        await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountId, usdMarketId, withdrawAmt);
      });

      after(restore);

      it.skip('has correct available margin', async () => {
        assertBn.equal(await systems().PerpsMarket.getAvailableMargin(accountId), initialMarginReq);
      });
    });

    describe('failures', () => {
      it.skip('reverts when withdrawing more than collateral', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(trader1())
            .modifyCollateral(accountId, usdMarketId, bn(-18_001)),
          `InsufficientCollateral("${usdMarketId}", "${bn(18_000)}", "${bn(18_001)}")`
        );
      });

      it.skip('reverts when withdrawing more than "collateral available for withdraw"', async () => {
        // Note that more low level tests related to specific maintenance margins are done in the liquidation tests

        // calculate liquidation rewards based on price, sizes and liquidation reward ratio
        const liquidationRewards = wei(2)
          .mul(wei(30_000))
          .mul(wei(0.05))
          .add(wei(20).mul(wei(2_000).mul(wei(0.05))));

        await assertRevert(
          systems()
            .PerpsMarket.connect(trader1())
            .modifyCollateral(accountId, usdMarketId, bn(-18000)),
          `InsufficientCollateralAvailableForWithdraw("${bn(14000).sub(
            liquidationRewards.toBN()
          )}", "${bn(18000)}")`
        );
      });

      describe('account liquidatable', () => {
        before('eth dumps making our account liquidatable', async () => {
          await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(5));
        });

        it.skip('reverts when withdrawing due to position liquidatable', async () => {
          await assertRevert(
            systems()
              .PerpsMarket.connect(trader1())
              .modifyCollateral(accountId, usdMarketId, bn(-100)),
            `AccountLiquidatable("${accountId}")`
          );
        });
      });
    });
  });
});
