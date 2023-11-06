import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { depositCollateral, openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('Keeper Rewards - Caps', () => {
  const KeeperCosts = {
    settlementCost: 1111,
    flagCost: 3333,
    liquidateCost: 5555,
  };
  const { systems, perpsMarkets, provider, trader1, keeperCostOracleNode, keeper, owner } =
    bootstrapMarkets({
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'snxBTC',
          buyPrice: bn(10_000),
          sellPrice: bn(10_000),
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

  before('identify actors', () => {
    ethMarketId = perpsMarkets()[0].marketId();
    ethSettlementStrategyId = perpsMarkets()[0].strategyId();
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

  const capTestCases = [
    {
      name: 'uncapped just cost',
      withRatio: false,
      lowerCap: 1,
      lowerProfitRatio: bn(0.005),
      higherCap: bn(10),
      higherProfitRatio: bn(0.005),
      expected: Math.trunc((KeeperCosts.flagCost + KeeperCosts.liquidateCost) * (1 + 0.005)),
    },
    {
      name: 'lower capped just cost',
      withRatio: false,
      lowerCap: 10_000,
      lowerProfitRatio: bn(0.005),
      higherCap: 10_0000,
      higherProfitRatio: bn(0.005),
      expected: 10_000 + (KeeperCosts.flagCost + KeeperCosts.liquidateCost),
    },
    {
      name: 'higher capped just cost',
      withRatio: false,
      lowerCap: 1,
      lowerProfitRatio: bn(0.005),
      higherCap: 100,
      higherProfitRatio: bn(0.005),
      expected: 100,
    },
    {
      name: 'uncapped plus reward ratio',
      withRatio: true,
      lowerCap: 1,
      lowerProfitRatio: bn(0.005),
      higherCap: bn(10),
      higherProfitRatio: bn(0.005),
      expected: bn(5).add(Math.trunc(KeeperCosts.flagCost + KeeperCosts.liquidateCost)),
    },
    {
      name: 'lower capped plus reward ratio',
      withRatio: true,
      lowerCap: bn(8),
      lowerProfitRatio: bn(0.005),
      higherCap: bn(10),
      higherProfitRatio: bn(0.005),
      expected: bn(8).add(KeeperCosts.flagCost + KeeperCosts.liquidateCost),
    },
    {
      name: 'higher capped plus reward ratio',
      withRatio: true,
      lowerCap: bn(1),
      lowerProfitRatio: bn(0.005),
      higherCap: bn(3),
      higherProfitRatio: bn(0.005),
      expected: bn(3),
    },
  ];

  for (let i = 0; i < capTestCases.length; i++) {
    const test = capTestCases[i];
    describe(`${test.name}`, () => {
      let liquidateTxn: ethers.providers.TransactionResponse;
      before(restoreToConfiguration);

      before('set minLiquidationRewardUsd, maxLiquidationRewardUsd', async () => {
        await systems().PerpsMarket.setKeeperRewardGuards(
          test.lowerCap,
          test.lowerProfitRatio,
          test.higherCap,
          test.higherProfitRatio
        );
      });

      before('set liquidation reward ratio', async () => {
        if (test.withRatio) {
          const initialMarginFraction = bn(0);
          const maintenanceMarginScalar = bn(0);
          const minimumInitialMarginRatio = bn(0);
          const liquidationRewardRatio = bn(0.05); // 100 * 0.05 = 5
          const minimumPositionMargin = bn(0);
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
        }
      });

      before('add collateral', async () => {
        await depositCollateral(collateralsTestCase[0].collateralData);
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
          `AccountLiquidationAttempt(2, ${test.expected}, true)`, // not capped
          systems().PerpsMarket
        );
      });
    });
  }
});
