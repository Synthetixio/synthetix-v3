import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

import { wei } from '@synthetixio/wei';
import { OpenPositionData, openPosition } from '../helpers';

const sUSDSynthId = 0;
describe('ModifyCollateral Withdraw', () => {
  const accountIds = [10, 20];
  const oneBTC = wei(1);
  const marginAmount = wei(10_000);
  const depositAmount = wei(1);
  const withdrawAmount = wei(0.1);
  const BTC_PRICE = wei(10_000);

  const { systems, owner, synthMarkets, provider, superMarketId, trader1, trader2 } =
    bootstrapMarkets({
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'snxBTC',
          buyPrice: BTC_PRICE.toBN(),
          sellPrice: BTC_PRICE.toBN(),
        },
      ],
      perpsMarkets: [],
      traderAccountIds: accountIds,
    });
  let synthBTCMarketId: ethers.BigNumber;

  before('identify actors', () => {
    synthBTCMarketId = synthMarkets()[0].marketId();
  });

  const restoreToSetup = snapshotCheckpoint(provider);

  describe('withdraw without open position modifyCollateral() from another account', () => {
    before('owner sets limits to max', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthBTCMarketId, ethers.constants.MaxUint256, 0, 0, 0);
    });

    before('trader1 buys 1 snxBTC', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthBTCMarketId, marginAmount.toBN(), oneBTC.toBN(), ethers.constants.AddressZero);
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
        .modifyCollateral(accountIds[1], sUSDSynthId, depositAmount.toBN());
    });
    it('reverts when trader1 tries to withdraw snxUSD', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], sUSDSynthId, withdrawAmount.mul(-1).toBN()),
        `InsufficientSynthCollateral("${sUSDSynthId}", "0", "${withdrawAmount.toBN()}")`
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
        .setCollateralConfiguration(synthBTCMarketId, ethers.constants.MaxUint256, 0, 0, 0);
    });

    before('trader1 buys 1 snxBTC', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthBTCMarketId, marginAmount.toBN(), oneBTC.toBN(), ethers.constants.AddressZero);
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
      assertBn.equal(totalValue, depositAmount.sub(withdrawAmount).mul(BTC_PRICE).toBN());
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
    const perpsMarketConfigs = [
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
          minimumPositionMargin: bn(0),
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
          minimumPositionMargin: bn(0),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
      },
    ];

    // Used to ensure non snxUSD collateral works as expected
    const spotMarketConfig = [
      {
        name: 'Ether',
        token: 'snxETH',
        buyPrice: bn(2000),
        sellPrice: bn(2000),
      },
    ];
    const traderAccountIds = [2, 3];
    const trader1AccountId = traderAccountIds[0];
    const { systems, provider, trader1, perpsMarkets, synthMarkets } = bootstrapMarkets({
      synthMarkets: spotMarketConfig,
      perpsMarkets: perpsMarketConfigs,
      liquidationGuards: {
        minLiquidationReward: bn(0),
        minKeeperProfitRatioD18: bn(0),
        maxLiquidationReward: bn(10_000),
        maxKeeperScalingRatioD18: bn(1),
      },

      traderAccountIds,
    });
    before('add some snx collateral to margin', async () => {
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(trader1AccountId, sUSDSynthId, bn(18000));
    });
    before('trader1 buys 1 snxETH', async () => {
      const ethSpotMarketId = synthMarkets()[0].marketId();
      const usdAmount = bn(2000);
      const minAmountReceived = bn(1);
      const referrer = ethers.constants.AddressZero;
      await systems()
        .SpotMarket.connect(trader1())
        .buy(ethSpotMarketId, usdAmount, minAmountReceived, referrer);
    });
    before('add some stop ETH collateral to margin', async () => {
      const ethSpotMarketId = synthMarkets()[0].marketId();
      // approve amount of collateral to be transfered to the market
      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(trader1AccountId, ethSpotMarketId, bn(1));
    });

    let commonOpenPositionProps: Pick<
      OpenPositionData,
      'systems' | 'provider' | 'trader' | 'accountId' | 'keeper'
    >;
    before('identify common props', async () => {
      commonOpenPositionProps = {
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: trader1(),
      };
    });
    before('open positions', async () => {
      const positionSizes = [
        bn(-2), // btc short
        bn(20), // eth long
      ];

      for (const [i, perpsMarket] of perpsMarkets().entries()) {
        await openPosition({
          ...commonOpenPositionProps,
          marketId: perpsMarket.marketId(),
          sizeDelta: positionSizes[i],
          settlementStrategyId: perpsMarket.strategyId(),
          price: perpsMarketConfigs[i].price,
        });
      }
    });
    describe('account check after initial positions open', () => {
      it('should have correct open interest', async () => {
        const expectedOi = 100_000; // abs((-2 * 30000) + (20 * 2000))
        assertBn.equal(
          await systems().PerpsMarket.totalAccountOpenInterest(trader1AccountId),
          bn(expectedOi)
        );
      });
      it('has correct pnl, given our position changed the skew', async () => {
        const [btcPnl] = await systems().PerpsMarket.getOpenPosition(
          trader1AccountId,
          perpsMarkets()[0].marketId()
        );
        assertBn.equal(btcPnl, bn(-600));
        const [ethPnl] = await systems().PerpsMarket.getOpenPosition(
          trader1AccountId,
          perpsMarkets()[1].marketId()
        );
        assertBn.equal(ethPnl, bn(-400));
      });
      it('has correct available margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(trader1AccountId),
          bn(19000) // collateral value  + pnl =  20000 + -1000
        );
      });
    });
    describe('allow withdraw when its less than collateral available for withdraw', () => {
      const restore = snapshotCheckpoint(provider);

      let initialMarginReq: ethers.BigNumber;
      let balBeforeWithdraw: ethers.BigNumber;
      let balAfterWithdraw: ethers.BigNumber;
      let withdrawAmt: ethers.BigNumber;

      before('withdraw allowed amount', async () => {
        [initialMarginReq] = await systems()
          .PerpsMarket.connect(trader1())
          .getRequiredMargins(trader1AccountId);
        // available margin = collateral value + pnl = $19000
        withdrawAmt = bn(19_000).sub(initialMarginReq).mul(-1);

        const trader1Address = await trader1().getAddress();
        balBeforeWithdraw = await systems().USD.connect(trader1()).balanceOf(trader1Address);

        await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(trader1AccountId, sUSDSynthId, withdrawAmt);

        balAfterWithdraw = await systems().USD.connect(trader1()).balanceOf(trader1Address);
      });
      after(restore);

      it('has correct available margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(trader1AccountId),
          initialMarginReq
        );
      });
      it('correct amount of sUSD minted to trader1 after withdrawal', async () => {
        assertBn.equal(balBeforeWithdraw.sub(balAfterWithdraw), withdrawAmt);
      });
    });

    describe('failures', () => {
      it('reverts when withdrawing more than collateral', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(trader1())
            .modifyCollateral(trader1AccountId, sUSDSynthId, bn(-18_001)),
          `InsufficientCollateral("${sUSDSynthId}", "${bn(18_000)}", "${bn(18_001)}")`
        );
      });
      it('reverts when withdrawing more than "collateral available for withdraw"', async () => {
        // Note that more low level tests related to specific maintenance margins are done in the liquidation tests

        // calculate liquidation rewards based on price, sizes and liquidation reward ratio
        const liquidationRewards = wei(2)
          .mul(wei(30_000))
          .mul(wei(0.05))
          .add(wei(20).mul(wei(2_000).mul(wei(0.05))));
        await assertRevert(
          systems()
            .PerpsMarket.connect(trader1())
            .modifyCollateral(trader1AccountId, sUSDSynthId, bn(-18000)),
          `InsufficientCollateralAvailableForWithdraw("${bn(14000).sub(
            liquidationRewards.toBN()
          )}", "${bn(18000)}")`
        );
      });

      describe('account liquidatable', () => {
        before('eth dumps making our account liquidatable', async () => {
          await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(5));
        });

        it('reverts when withdrawing due to position liquidatable', async () => {
          await assertRevert(
            systems()
              .PerpsMarket.connect(trader1())
              .modifyCollateral(trader1AccountId, sUSDSynthId, bn(-100)),
            `AccountLiquidatable("${trader1AccountId}")`
          );
        });
      });
    });
  });
});
