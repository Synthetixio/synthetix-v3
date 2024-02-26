import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { wei } from '@synthetixio/wei';
import { openPosition, ONE_ETHER, getQuantoPositionSize } from '../../integration/helpers';

describe('ModifyCollateral Withdraw', () => {
  // Account and Market Identifiers
  const accountIds = [10, 20, 69];
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
  const {
    systems,
    owner,
    provider,
    trader1,
    trader2,
    trader3,
    superMarketId,
    perpsMarkets,
    synthMarkets,
  } = bootstrapMarkets({
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
    const trader3AccountId = accountIds[2];

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

    // Initial Profit and Loss
    let initialPnl: ethers.BigNumber;

    before('buy sETH via spot market', async () => {
      const usdAmount = initialAccountMargin.div(5);
      const minAmountReceived = initialAccountEthMargin;
      const referrer = ethers.constants.AddressZero;

      await synthMarkets()[1]
        .synth()
        .connect(trader3())
        .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);

      await systems()
        .SpotMarket.connect(trader3())
        .buy(synthETHMarketId, usdAmount, minAmountReceived, referrer);
    });

    before('add some sETH collateral to margin', async () => {
      await synthMarkets()[0]
        .synth()
        .connect(trader3())
        .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);

      await systems()
        .PerpsMarket.connect(trader3())
        .modifyCollateral(trader3AccountId, synthETHMarketId, initialAccountEthMargin);
    });

    before('add some sUSD collateral to margin', async () => {
      await systems()
        .PerpsMarket.connect(trader3())
        .modifyCollateral(trader3AccountId, usdMarketId, initialAccountUsdMargin);
    });

    before('open BTC position', async () => {
      quantoPositionSizeBtcMarket = getQuantoPositionSize({
        sizeInBaseAsset: perpPositionSizeBtcMarket,
        quantoAssetPrice: ethPrice,
      });

      await openPosition({
        systems,
        provider,
        trader: trader3(),
        accountId: trader3AccountId,
        keeper: trader3(),
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

      await openPosition({
        systems,
        provider,
        trader: trader3(),
        accountId: trader3AccountId,
        keeper: trader3(),
        marketId: ethMarketIdBn,
        sizeDelta: quantoPositionSizeEthMarket,
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: ethPrice,
      });
    });

    describe.skip('allow withdraw when its less than collateral available for withdraw', () => {
      const restore = snapshotCheckpoint(provider);

      let withdrawableMargin: ethers.BigNumber;

      before('withdraw allowed amount', async () => {
        const [requiredInitialMargin, , maxLiquidationReward] = await systems()
          .PerpsMarket.connect(trader3())
          .getRequiredMargins(trader3AccountId);

        const availableMargin = await systems()
          .PerpsMarket.connect(trader3())
          .getAvailableMargin(trader3AccountId);

        /**
         * per the contract:
         * availableWithdrawableCollateralUsd = availableMargin - (initialRequiredMargin + liquidationReward)
         */

        // results to 97492500000000000000000 * -1
        withdrawableMargin = availableMargin
          .sub(requiredInitialMargin.add(maxLiquidationReward))
          .mul(-1);

        // results to 97495000000000000000000
        const actualWithdrawableMargin = await systems()
          .PerpsMarket.connect(trader3())
          .getWithdrawableMargin(trader3AccountId);

        /**
         * two issues:
         * 1) `withdrawableMargin` != `actualWithdrawableMargin`; looking at contracts, getAccountRequiredMargins() is used to fetch
         *    initialRequiredMargin and liquidationReward in both cases.
         *    However, calling getWithdrawableMargin() directly excutes this logic: `withdrawableMargin = availableMargin - requiredMargin.toInt()`
         *    but when attempting to withdraw collateral, the system calculates margin via this logic:
         *    availableWithdrawableCollateralUsd = availableMargin.toUint() - requiredMargin. Why discrepency?
         *
         * 2) `withdrawableMargin` nor `actualWithdrawableMargin` are even close to `availableUsdDenominated` value thrown
         *    by the InsufficientCollateral custom error (which is 80000000000000000000000 and is calculate internally
         *    via getAvailableMargin() and getAccountRequiredMargins())
         */

        // 🚨 system throws stating max collateral available to withdraw is 80000000000000000000000
        await systems()
          .PerpsMarket.connect(trader3())
          .modifyCollateral(trader3AccountId, usdMarketId, withdrawableMargin);
      });

      // why restore "after" - and after what?
      after(restore);

      // what is the point of this?
      it('has correct available margin', async () => {
        const availableMargin = await systems().PerpsMarket.getAvailableMargin(trader3AccountId);
        const expectedAvailableMargin = initialAccountMargin
          .add(initialPnl)
          .add(withdrawableMargin);

        assertBn.equal(availableMargin, expectedAvailableMargin);
      });
    });

    describe('failures', () => {
      it('reverts when withdrawing more than collateral', async () => {
        const amountToWithdraw = initialAccountUsdMargin.add(1);

        await assertRevert(
          systems()
            .PerpsMarket.connect(trader3())
            .modifyCollateral(trader3AccountId, usdMarketId, amountToWithdraw.mul(-1)),
          `InsufficientCollateral("${usdMarketId}", "${initialAccountUsdMargin}", "${amountToWithdraw}")`
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
            .PerpsMarket.connect(trader3())
            .modifyCollateral(trader3AccountId, usdMarketId, bn(-18000)),
          `InsufficientCollateralAvailableForWithdraw("${bn(14000).sub(
            liquidationRewards.toBN()
          )}", "${bn(18000)}")`
        );
      });

      describe('account liquidatable', () => {
        before('increase eth position leverage', async () => {
          quantoPositionSizeEthMarket = getQuantoPositionSize({
            sizeInBaseAsset: perpPositionSizeEthMarket.mul(10),
            quantoAssetPrice: ethPrice,
          });

          await openPosition({
            systems,
            provider,
            trader: trader3(),
            accountId: trader3AccountId,
            keeper: trader3(),
            marketId: ethMarketIdBn,
            sizeDelta: quantoPositionSizeEthMarket,
            settlementStrategyId: perpsMarkets()[1].strategyId(),
            price: ethPrice,
          });
        });

        before('eth dumps making our account liquidatable', async () => {
          await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(0));
        });

        it('reverts when withdrawing due to position liquidatable', async () => {
          await assertRevert(
            systems()
              .PerpsMarket.connect(trader3())
              .modifyCollateral(trader3AccountId, usdMarketId, bn(-100)),
            `AccountLiquidatable("${trader3AccountId}")`
          );
        });
      });
    });
  });
});
