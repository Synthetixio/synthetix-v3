import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

import { wei } from '@synthetixio/wei';
import { OpenPositionData, openPosition } from '../integration/helpers';

// NOTE: this is based on ModifyCollateral.withdraw.test.ts
const sUSDSynthId = 0;
describe('Quanto', () => {
  const accountIds = [10, 20];
  const oneETH = wei(1);
  const marginAmount = wei(2_000);
  const depositAmount = wei(1);
  const withdrawAmount = wei(0.1);
  const ETH_PRICE = wei(2_000);

  // TODO: make this a quanto market or remove these tests
  const { systems, owner, synthMarkets, provider, superMarketId, trader1, trader2 } =
    bootstrapMarkets({
      synthMarkets: [
        {
          name: 'Ether',
          token: 'snxETH',
          buyPrice: ETH_PRICE.toBN(),
          sellPrice: ETH_PRICE.toBN(),
        },
      ],
      perpsMarkets: [],
      traderAccountIds: accountIds,
    });
  let synthETHMarketId: ethers.BigNumber;

  before('identify actors', () => {
    synthETHMarketId = synthMarkets()[0].marketId();
  });

  const restoreToSetup = snapshotCheckpoint(provider);

  describe('withdraw without open position modifyCollateral()', () => {
    let spotBalanceBefore: ethers.BigNumber;
    let modifyCollateralWithdrawTxn: ethers.providers.TransactionResponse;

    before(restoreToSetup);

    before('owner sets limits to max', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthETHMarketId, ethers.constants.MaxUint256);
    });

    before('trader1 buys 1 snxBTC', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthETHMarketId, marginAmount.toBN(), oneETH.toBN(), ethers.constants.AddressZero);
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
        .modifyCollateral(accountIds[0], synthETHMarketId, depositAmount.toBN());
    });
    before('trader1 withdraws some collateral', async () => {
      modifyCollateralWithdrawTxn = await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthETHMarketId, withdrawAmount.mul(-1).toBN());
    });

    it('properly reflects the total collateral value', async () => {
      const totalValue = await systems().PerpsMarket.totalCollateralValue(accountIds[0]);
      assertBn.equal(totalValue, depositAmount.sub(withdrawAmount).mul(ETH_PRICE).toBN());
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
        `CollateralModified(${accountIds[0]}, ${synthETHMarketId}, ${withdrawAmount
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
        fundingParams: { skewScale: bn(0), maxFundingVelocity: bn(0) },
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
        quanto: {
          name: 'Ether',
          token: 'ETH',
          price: bn(2_000),
          quantoSynthMarketIndex: 0,
        }
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
    const { systems, provider, trader1, perpsMarkets, synthMarkets, owner } = bootstrapMarkets({
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
    before('trader1 buys 10 snxETH', async () => {
      const ethSpotMarketId = synthMarkets()[0].marketId();
      const usdAmount = bn(20_000);
      const minAmountReceived = bn(10);
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
        .modifyCollateral(trader1AccountId, ethSpotMarketId, bn(10));
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
        // 2 BTC long position
        bn(2)
      ];

      await openPosition({
        ...commonOpenPositionProps,
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: positionSizes[0],
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: perpsMarketConfigs[0].price,
      });
    });
    describe('account check after initial positions open', () => {
      it('has correct quanto market id', async () => {
        const ethSpotMarketId = synthMarkets()[0].marketId();
        const btcPerpsMarketId = perpsMarkets()[0].marketId();
        assertBn.equal(
          await systems().PerpsMarket.getQuantoSynthMarket(btcPerpsMarketId),
          ethSpotMarketId
        );
      });
      it('should have correct open interest', async () => {
        const expectedOi = 60_000; // abs((-2 * 30000) + (20 * 2000))
        assertBn.equal(
          await systems().PerpsMarket.totalAccountOpenInterest(trader1AccountId),
          bn(expectedOi)
        );
      });
      it('has no pnl, given skewScale is set to zero', async () => {
        const [btcPnl] = await systems().PerpsMarket.getOpenPosition(
          trader1AccountId,
          perpsMarkets()[0].marketId()
        );
        assertBn.equal(btcPnl, 0);
      });
      it('has correct available margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(trader1AccountId),
          bn(20_000) // collateral value  + pnl =  20000 + 0
        );
      });
    });
    describe('allow withdraw when its less than collateral available for withdraw', () => {
      const restore = snapshotCheckpoint(provider);

      let initialMarginReq: ethers.BigNumber;

      before('withdraw allowed amount', async () => {
        const ethSpotMarketId = synthMarkets()[0].marketId();

        [initialMarginReq] = await systems()
        .PerpsMarket.connect(trader1())
        .getRequiredMargins(trader1AccountId);
        // available margin = collateral value + pnl = $19000
        const withdrawAmt = bn(20_000).sub(initialMarginReq).mul(-1).div(2000);

        await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(trader1AccountId, ethSpotMarketId, withdrawAmt);
      });
      after(restore);

      it('has correct available margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(trader1AccountId),
          initialMarginReq
        );
      });
    });
    describe('pnl adjusts correctly', () => {
      before('check initial margin is as expected', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(trader1AccountId),
          bn(2_000).mul(10)
        );
      });
      before('btc pumps', async () => {
        await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(40_000));
      });

      before('eth pumps', async () => {
        // update eth price on perps market (effects USD pnl)
        await perpsMarkets()[0].quantoAggregator().mockSetCurrentPrice(bn(4_000));
        // update eth price on synth market (effects collateral value)
        await synthMarkets()[0].sellAggregator().mockSetCurrentPrice(bn(4_000));
      });

      // NOTE: This test should fail based on a quanto payout, it succeeds with a classical payout
      it.skip('has correct margin based on classic perps price change', async () => {
        const expectedCollateral = bn(4_000).mul(10); // $40k collateral
        const classicPnl = bn(10_000).mul(2); // $20k profit
        const expectedMargin = expectedCollateral.add(classicPnl);

        // check the pnl
        const availableMargin = await systems().PerpsMarket.getAvailableMargin(trader1AccountId);
        assertBn.equal(
          availableMargin,
          expectedMargin
        );
      });

      it('has correct margin based on quanto perps price change', async () => {
        const expectedCollateral = bn(4_000).mul(10); // $40k collateral
        const quantoPnl = bn(10_000).mul(2).mul(2); // $40k profit
        const expectedMargin = expectedCollateral.add(quantoPnl);

        // check the pnl
        const availableMargin = await systems().PerpsMarket.getAvailableMargin(trader1AccountId);
        assertBn.equal(
          availableMargin,
          expectedMargin
        );
      });
    });
  });
});
