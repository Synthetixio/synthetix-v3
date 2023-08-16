import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { ethers } from 'ethers';
import { calculatePricePnl } from '../helpers/fillPrice';
import { wei } from '@synthetixio/wei';

describe('Liquidation - multi collateral', async () => {
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
        maxSecondsInLiquidationWindow: bn(10),
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
        maxSecondsInLiquidationWindow: bn(10),
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
        maxSecondsInLiquidationWindow: bn(10),
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
        maxLiquidationReward: bn(1000),
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

  // sanity check
  it('has correct total collateral value', async () => {
    assertBn.near(
      await systems().PerpsMarket.totalCollateralValue(2),
      bn(10_000 + 4000),
      bn(0.00001)
    );
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
      bn(-1), // btc short
      bn(20), // eth long
      bn(2000), // link long
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

  describe('account check after initial positions open', async () => {
    it('should have correct open interest', async () => {
      assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), bn(80_000));
    });

    [
      { size: bn(-1) }, // btc
      { size: bn(20) }, // eth
      { size: bn(2000) }, // link
    ].forEach(({ size }, i) => {
      it(`should have correct position for ${perpsMarketConfigs[i].token}`, async () => {
        const [positionPnl, , positionSize] = await systems().PerpsMarket.getOpenPosition(
          2,
          perpsMarkets()[i].marketId()
        );
        const pnl = calculatePricePnl(
          wei(0),
          wei(perpsMarketConfigs[i].fundingParams.skewScale),
          wei(size),
          wei(perpsMarketConfigs[i].price)
        ).toBN();
        assertBn.equal(positionPnl, pnl);
        assertBn.equal(positionSize, size);
      });
    });
  });

  describe('make account liquidatable', () => {
    before('change perps token price', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(31000)); // btc
      await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(1625)); // eth
      await perpsMarkets()[2].aggregator().mockSetCurrentPrice(bn(3)); // link
    });

    let liquidateTxn: ethers.providers.TransactionResponse;
    before('liquidate account', async () => {
      liquidateTxn = await systems().PerpsMarket.connect(keeper()).liquidate(2);
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
        `AccountLiquidated(2, ${bn(1000)}, true)`, // max liquidation reward $1000
        systems().PerpsMarket
      );
    });

    it('sent reward to keeper', async () => {
      assertBn.equal(await systems().USD.balanceOf(await keeper().getAddress()), bn(1000));
    });

    [bn(1), bn(20), bn(2000)].forEach((liquidatedSize, i) => {
      it(`emits position liquidated event`, async () => {
        await assertEvent(
          liquidateTxn,
          `PositionLiquidated(2, ${perpsMarkets()[i].marketId()}, ${liquidatedSize}, 0)`,
          systems().PerpsMarket
        );
      });
    });

    it('sold all market collateral for usd', async () => {
      assertBn.equal(
        await systems().Core.getMarketCollateralAmount(superMarketId(), btcSynth.synthAddress()),
        bn(0)
      );

      assertBn.equal(
        await systems().Core.getMarketCollateralAmount(superMarketId(), ethSynth.synthAddress()),
        bn(0)
      );
    });

    // all collateral is still in the core system
    it('has correct market usd', async () => {
      // $14_000 total collateral value
      // $1000 paid to liquidation reward
      assertBn.near(
        await systems().Core.getWithdrawableMarketUsd(superMarketId()),
        startingWithdrawableUsd.add(bn(13_000)),
        bn(0.00001)
      );
    });
  });

  // sanity check to ensure trader can add margin and open new positions after full account liquidation
  describe('account can open new position', () => {
    before('set btc price back to 30000', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(30000));
    });

    before('add margin', async () => {
      await depositCollateral({
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            synthMarket: () => ethSynth,
            snxUSDAmount: () => bn(4000),
          },
        ],
      });
    });

    before('open new position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: trader1(),
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(-1),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: perpsMarketConfigs[0].price,
      });
    });

    it('has correct open interest', async () => {
      assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), bn(30_000));
    });
  });
});
