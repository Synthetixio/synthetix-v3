import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { depositCollateral, openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe.skip('Keeper Rewards - Caps', () => {
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

  before('identify actors', async () => {
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

  describe('uncapped', () => {
    let liquidateTxn: ethers.providers.TransactionResponse;
    before(restoreToConfiguration);

    before('set minLiquidationRewardUsd, maxLiquidationRewardUsd', async () => {
      await systems().PerpsMarket.setLiquidationRewardGuards(1, 10_000);
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
        `AccountLiquidated(2, ${KeeperCosts.flagCost + KeeperCosts.liquidateCost}, true)`, // not capped
        systems().PerpsMarket
      );
    });
  });
  // describe('2 small positions', () => {
  //   before(restoreToConfiguration);

  //   it('void test works', () => {
  //     // void
  //     assertBn.equal(bn(1), bn(1));
  //   });
  // });
  // describe('1 small, 1 large positions', () => {
  //   before(restoreToConfiguration);

  //   it('void test works', () => {
  //     // void
  //     assertBn.equal(bn(1), bn(1));
  //   });
  // });
  // describe('multi collateral and 1 small position', () => {
  //   before(restoreToConfiguration);

  //   it('void test works', () => {
  //     // void
  //     assertBn.equal(bn(1), bn(1));
  //   });
  // });
  // describe('2 accounts multi-step', () => {
  //   before(restoreToConfiguration);

  //   it('void test works', () => {
  //     // void
  //     assertBn.equal(bn(1), bn(1));
  //   });
  // });
});
