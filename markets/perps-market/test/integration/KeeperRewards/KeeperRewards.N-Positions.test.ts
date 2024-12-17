import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { depositCollateral, openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('Keeper Rewards - Multiple Positions', () => {
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
          name: 'Optimism',
          token: 'snxOP',
          price: bn(10),
          fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
        },
        {
          requestedMarketId: 35,
          name: 'Link',
          token: 'snxLINK',
          price: bn(100),
          fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
        },
      ],
      traderAccountIds: [2, 3],
    });
  let ethMarketId: ethers.BigNumber;
  let opMarketId: ethers.BigNumber;
  let linkMarketId: ethers.BigNumber;
  let ethSettlementStrategyId: ethers.BigNumber;
  let liquidateTxn: ethers.providers.TransactionResponse;

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    opMarketId = perpsMarkets()[1].marketId();
    linkMarketId = perpsMarkets()[2].marketId();
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

  before('set minLiquidationRewardUsd, maxLiquidationRewardUsd - uncapped', async () => {
    await systems().PerpsMarket.setKeeperRewardGuards(1, 0, bn(100), bn(0.005));
  });

  before('set liquidation reward ratio', async () => {
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

    await systems()
      .PerpsMarket.connect(owner())
      .setLiquidationParameters(
        opMarketId,
        initialMarginFraction,
        maintenanceMarginScalar,
        minimumInitialMarginRatio,
        liquidationRewardRatio,
        minimumPositionMargin
      );

    await systems()
      .PerpsMarket.connect(owner())
      .setLiquidationParameters(
        linkMarketId,
        initialMarginFraction,
        maintenanceMarginScalar,
        minimumInitialMarginRatio,
        liquidationRewardRatio,
        minimumPositionMargin
      );
  });

  before('add collateral', async () => {
    await depositCollateral(collateralsTestCase[0].collateralData);
  });

  before('open positions', async () => {
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
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: opMarketId,
      sizeDelta: bn(100),
      settlementStrategyId: ethSettlementStrategyId,
      price: bn(10),
    });
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: linkMarketId,
      sizeDelta: bn(100),
      settlementStrategyId: ethSettlementStrategyId,
      price: bn(100),
    });
  });

  before('lower price to liquidation', async () => {
    await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(1));
    await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(2));
    await perpsMarkets()[2].aggregator().mockSetCurrentPrice(bn(3));
  });

  let initialKeeperBalance: ethers.BigNumber;
  before('call liquidate', async () => {
    initialKeeperBalance = await systems().USD.balanceOf(await keeper().getAddress());
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
    await assertEvent(
      liquidateTxn,
      `PositionLiquidated(2, 30, ${bn(100)}, 0)`,
      systems().PerpsMarket
    );
    await assertEvent(
      liquidateTxn,
      `PositionLiquidated(2, 35, ${bn(100)}, 0)`,
      systems().PerpsMarket
    );
  });

  it('emits account liquidated event', async () => {
    // for each position: size * price * rewardRatio
    // eth :  100 * 1 * 0.05
    // op  :  200 * 1 * 0.05
    // link:  300 * 1 * 0.05
    const keeperRewardRatio = bn(100 * 0.05)
      .add(bn(200 * 0.05))
      .add(bn(300 * 0.05));

    // 3 positions, snxUSD collateral
    const expected = keeperRewardRatio.add(KeeperCosts.flagCost * 3 + KeeperCosts.liquidateCost);

    await assertEvent(
      liquidateTxn,
      `AccountLiquidationAttempt(2, ${expected}, true)`, // not capped
      systems().PerpsMarket
    );
  });

  it('keeper gets paid', async () => {
    const keeperBalance = await systems().USD.balanceOf(await keeper().getAddress());
    const keeperRewardRatio = bn(100 * 0.05)
      .add(bn(200 * 0.05))
      .add(bn(300 * 0.05));

    // 3 positions, snxUSD collateral
    const expected = keeperRewardRatio.add(KeeperCosts.flagCost * 3 + KeeperCosts.liquidateCost);
    assertBn.equal(keeperBalance, initialKeeperBalance.add(expected));
  });
});
