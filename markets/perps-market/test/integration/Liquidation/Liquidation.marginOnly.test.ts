import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { depositCollateral, openPosition } from '../helpers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { ethers } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import assert from 'assert/strict';

describe('Liquidation - liquidateMarginOnly', () => {
  const perpsMarketConfigs = [
    {
      requestedMarketId: 50,
      name: 'Bitcoin',
      token: 'BTC',
      price: bn(30_000),
      fundingParams: { skewScale: bn(100), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.01),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.01),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 51,
      name: 'Ether',
      token: 'ETH',
      price: bn(2000),
      fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.01),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.02),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 52,
      name: 'Link',
      token: 'LINK',
      price: bn(5),
      fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
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

  const { systems, provider, trader1, synthMarkets, keeper, superMarketId, perpsMarkets } =
    bootstrapMarkets({
      liquidationGuards: {
        minLiquidationReward: bn(10),
        minKeeperProfitRatioD18: bn(0),
        maxLiquidationReward: bn(1000),
        maxKeeperScalingRatioD18: bn(0.5),
      },
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'snxBTC',
          buyPrice: bn(30_000),
          sellPrice: bn(30_000),
        },
        {
          name: 'Ethereum',
          token: 'snxETH',
          buyPrice: bn(2000),
          sellPrice: bn(2000),
        },
      ],
      perpsMarkets: perpsMarketConfigs,
      traderAccountIds: [2, 3],
      collateralLiquidateRewardRatio: bn(0.01),
    });

  let btcSynth: SynthMarkets[number],
    ethSynth: SynthMarkets[number],
    startingWithdrawableUsd: ethers.BigNumber;

  before('identify actors', async () => {
    btcSynth = synthMarkets()[0];
    ethSynth = synthMarkets()[1];
    startingWithdrawableUsd = await systems().Core.getWithdrawableMarketUsd(superMarketId());
  });

  before('add collateral to margin', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 2,
      collaterals: [
        {
          synthMarket: () => btcSynth,
          snxUSDAmount: () => bn(10_000),
        },
        {
          synthMarket: () => ethSynth,
          snxUSDAmount: () => bn(4000),
        },
      ],
    });
  });

  const restore = snapshotCheckpoint(provider);

  // sanity check
  it('has correct total collateral value', async () => {
    assertBn.near(
      await systems().PerpsMarket.totalCollateralValue(2),
      bn(10_000 + 4000),
      bn(0.00001)
    );
  });

  describe('with open positions', () => {
    before('open positions', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: trader1(),
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(1),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: perpsMarketConfigs[0].price,
      });
    });

    after(restore);

    it('should revert attempting to liquidate account with open positions', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(keeper()).liquidateMarginOnly(2),
        'AccountHasOpenPositions'
      );
    });
  });

  describe('after some loses and with no open positions', () => {
    before('make the user increase their debt', async () => {
      // open a position
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: trader1(),
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(1),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: perpsMarketConfigs[0].price,
      });

      const newBTCPrice = bn(29_000);
      // should incurr in a loss of 1000 (1 * 30_000 - 1 * 29_000)
      // move price in the oposite direction (to have a negative pnl)
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(newBTCPrice);

      // close the position (open same as negative size)
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: trader1(),
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(-1),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: newBTCPrice,
      });
    });

    before('move collateral prices to a border zone', async () => {
      // we have 1000 of debt.
      // and .3 BTC + 2 ETH as collateral. In order to make it liquidatable we need to move the price of the collateral

      // notice we are not taking into account any fees or funding or pd

      await btcSynth.sellAggregator().mockSetCurrentPrice(bn(2000)); // .3 * 2000 = 600
      await ethSynth.sellAggregator().mockSetCurrentPrice(bn(200)); // 2 * 200 = 400
    });

    it('shows account is not liquidatable', async () => {
      assert.equal(await systems().PerpsMarket.canLiquidateMarginOnly(2), false);
    });

    it('cannot liquidate if account is not liquidatable', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(keeper()).liquidateMarginOnly(2),
        'NotEligibleForMarginLiquidation'
      );
    });

    describe('make account liquidatable', () => {
      before('move collateral prices a bit more', async () => {
        await ethSynth.sellAggregator().mockSetCurrentPrice(bn(150)); // 2 * 150 = 300
        // now it should be liquidatable
      });

      it('should be liquidatable', async () => {
        assert.equal(await systems().PerpsMarket.canLiquidateMarginOnly(2), true);
      });

      describe('liquidate the account', () => {
        let liquidateTxn: ethers.providers.TransactionResponse;
        before('liquidate account', async () => {
          liquidateTxn = await systems().PerpsMarket.connect(keeper()).liquidateMarginOnly(2);
        });

        it('empties account margin', async () => {
          assertBn.equal(await systems().PerpsMarket.totalCollateralValue(2), 0);
        });

        it('empties open interest', async () => {
          assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), 0);
        });

        it('emits account liquidated event', async () => {
          await assertEvent(
            liquidateTxn,
            `AccountLiquidationAttempt(2, ${bn(10)}, true)`, // liquidation reward $1000 * 0.01 = 10
            systems().PerpsMarket
          );
        });

        it('sent reward to keeper', async () => {
          assertBn.equal(await systems().USD.balanceOf(await keeper().getAddress()), bn(10));
        });

        it('sold all market collateral for usd', async () => {
          assertBn.equal(
            await systems().Core.getMarketCollateralAmount(
              superMarketId(),
              btcSynth.synthAddress()
            ),
            bn(0)
          );

          assertBn.equal(
            await systems().Core.getMarketCollateralAmount(
              superMarketId(),
              ethSynth.synthAddress()
            ),
            bn(0)
          );
        });

        // all collateral is still in the core system
        it('has correct market usd', async () => {
          // $14_000 total collateral value, but was liquidated so it should be 0
          // $10 paid to liquidation reward
          assertBn.near(
            await systems().Core.getWithdrawableMarketUsd(superMarketId()),
            startingWithdrawableUsd.sub(bn(10)),
            bn(0.00001)
          );
        });

        it('should not have a pending order', async () => {
          const order = await systems().PerpsMarket.getOrder(2);
          assertBn.equal(order.request.accountId, 2);
          assertBn.equal(order.request.sizeDelta, bn(0));
        });
      });
    });

    describe('sanity check. Can deposit more collateral and open a position', () => {
      before('set prices as before to simplify test', async () => {
        await btcSynth.sellAggregator().mockSetCurrentPrice(bn(30_000));
        await ethSynth.sellAggregator().mockSetCurrentPrice(bn(2000));
      });

      before('add collateral to margin', async () => {
        await depositCollateral({
          systems,
          trader: trader1,
          accountId: () => 2,
          collaterals: [
            {
              synthMarket: () => btcSynth,
              snxUSDAmount: () => bn(10_000),
            },
            {
              synthMarket: () => ethSynth,
              snxUSDAmount: () => bn(4000),
            },
          ],
        });
      });

      it('has correct total collateral value and can open a position', async () => {
        assertBn.near(
          await systems().PerpsMarket.totalCollateralValue(2),
          bn(10_000 + 4000),
          bn(0.00001)
        );

        await openPosition({
          systems,
          provider,
          trader: trader1(),
          accountId: 2,
          keeper: trader1(),
          marketId: perpsMarkets()[0].marketId(),
          sizeDelta: bn(1),
          settlementStrategyId: perpsMarkets()[0].strategyId(),
          price: perpsMarketConfigs[0].price,
        });
      });
    });
  });
});
