import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { depositCollateral, openPosition } from '../helpers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe.only('Keeper Rewards - Collaterals', () => {
  const KeeperCosts = {
    settlementCost: 1111,
    flagCost: 3333,
    liquidateCost: 5555,
  };
  const {
    systems,
    perpsMarkets,
    synthMarkets,
    provider,
    trader1,
    keeperCostOracleNode,
    keeper,
    owner,
  } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(10_000),
        sellPrice: bn(10_000),
      },
      {
        name: 'Ethereum',
        token: 'snxETH',
        buyPrice: bn(1_000),
        sellPrice: bn(1_000),
      },
    ],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
      },
      {
        requestedMarketId: 30,
        name: 'Link',
        token: 'snxLINK',
        price: bn(5000),
        fundingParams: { skewScale: bn(200_000), maxFundingVelocity: bn(20) },
      },
    ],
    traderAccountIds: [2, 3],
  });
  let ethMarketId: ethers.BigNumber;
  let ethSettlementStrategyId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];
  let ethSynth: SynthMarkets[number];

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    ethSettlementStrategyId = perpsMarkets()[0].strategyId();
    btcSynth = synthMarkets()[0];
    ethSynth = synthMarkets()[1];
  });

  const collateralsTestCase = [
    {
      name: 'only snxUSD',
      collateralData: {
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            snxUSDAmount: () => bn(10_000),
          },
          {
            synthMarket: () => btcSynth,
            snxUSDAmount: () => bn(1_000),
          },
          {
            synthMarket: () => ethSynth,
            snxUSDAmount: () => bn(1_000),
          },
        ],
      },
    },
  ];

  before('set keeper costs', async () => {
    await keeperCostOracleNode()
      .connect(owner())
      .setCosts(KeeperCosts.settlementCost, KeeperCosts.flagCost, KeeperCosts.liquidateCost);
  });

  const restoreToConfiguration = snapshotCheckpoint(provider);

  it('keeper costs are configured correctly', async () => {
    // Note: `it` required to ensure the `describes` below work as expected
    assertBn.equal(await keeperCostOracleNode().settlementCost(), KeeperCosts.settlementCost);
    assertBn.equal(await keeperCostOracleNode().flagCost(), KeeperCosts.flagCost);
    assertBn.equal(await keeperCostOracleNode().liquidateCost(), KeeperCosts.liquidateCost);
  });

  [
    // {
    //   name: 'uncapped just cost',
    //   withRatio: false,
    //   lowerCap: 1,
    //   higherCap: bn(10),
    //   expected: KeeperCosts.flagCost + KeeperCosts.liquidateCost,
    // },
    {
      name: 'uncapped plus reward ratio',
      withRatio: true,
      lowerCap: 1,
      higherCap: bn(10),
      expected: bn(5).add(KeeperCosts.flagCost + KeeperCosts.liquidateCost),
    },
  ].forEach((test) => {
    describe(`${test.name}`, () => {
      let liquidateTxn: ethers.providers.TransactionResponse;
      before(restoreToConfiguration);

      before('set minLiquidationRewardUsd, maxLiquidationRewardUsd', async () => {
        await systems().PerpsMarket.setLiquidationRewardGuards(test.lowerCap, test.higherCap);
      });

      before('set liquidation reward ratio', async () => {
        if (test.withRatio) {
          const initialMarginFraction = bn(0);
          const maintenanceMarginScalar = bn(0);
          const minimumInitialMarginRatio = bn(0);
          const liquidationRewardRatio = bn(0.05); // 100 * 0.05 = 5
          const minimumPositionMargin = bn(0);
          // const maxLiquidationLimitAccumulationMultiplier = bn(1);
          // const maxSecondsInLiquidationWindow = ethers.BigNumber.from(10);
          await systems()
            .PerpsMarket.connect(owner())
            .setLiquidationParameters(
              ethMarketId,
              initialMarginFraction,
              maintenanceMarginScalar,
              minimumInitialMarginRatio,
              liquidationRewardRatio,
              minimumPositionMargin
            );
          // await systems()
          //   .PerpsMarket.connect(owner())
          //   .setMaxLiquidationParameters(
          //     ethMarketId,
          //     maxLiquidationLimitAccumulationMultiplier,
          //     maxSecondsInLiquidationWindow,
          //     0,
          //     ethers.constants.AddressZero
          //   );
        }
      });

      before('add collateral', async () => {
        const res = await depositCollateral(collateralsTestCase[0].collateralData);
        // res.stats().forEach((stat) => {
        //   console.log('spotInitialBalance', stat.spotInitialBalance().toString());
        //   console.log('perpsInitialBalance', stat.perpsInitialBalance().toString());
        //   console.log('tradeFee', stat.tradeFee().toString());
        //   console.log('spotFinalBalance', stat.spotFinalBalance().toString());
        //   console.log('perpsFinalBalance', stat.perpsFinalBalance().toString());
        // });
        console.log('xxxxx', await systems().PerpsMarket.totalCollateralValue(2));
        console.log('xxxxx snxUSD', await systems().PerpsMarket.getCollateralAmount(2, 0));
        console.log(
          'xxxxx snxBTC',
          await systems().PerpsMarket.getCollateralAmount(2, btcSynth.marketId())
        );
        console.log(
          'xxxxx snxETH',
          await systems().PerpsMarket.getCollateralAmount(2, ethSynth.marketId())
        );
      });

      before('open position', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader1(),
          accountId: 2,
          keeper: keeper(),
          marketId: ethMarketId,
          sizeDelta: bn(100),
          settlementStrategyId: ethSettlementStrategyId,
          price: bn(1000),
        });
      });

      before('lower price to liquidation', async () => {
        await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(1));
      });

      before('liquidate account', async () => {
        liquidateTxn = await systems().PerpsMarket.connect(keeper()).liquidate(2);
      });

      it('emits position liquidated event', async () => {
        await assertEvent(
          liquidateTxn,
          `PositionLiquidated(2, 25, ${bn(100)}, 0)`,
          systems().PerpsMarket
        );
      });

      it('emits account liquidated event', async () => {
        await assertEvent(
          liquidateTxn,
          `AccountLiquidated(2, ${test.expected}, true)`, // not capped
          systems().PerpsMarket
        );
      });
    });
  });
});
