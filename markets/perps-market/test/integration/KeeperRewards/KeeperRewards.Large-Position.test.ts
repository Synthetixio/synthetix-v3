import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { depositCollateral, openPosition } from '../helpers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo, getTxTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('Keeper Rewards - Multiple Liquidation steps', () => {
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
          orderFees: {
            makerFee: bn(0.007),
            takerFee: bn(0.003),
          },
          fundingParams: { skewScale: bn(1_000), maxFundingVelocity: bn(10) },
        },
      ],
      traderAccountIds: [2, 3],
    });
  let ethMarketId: ethers.BigNumber;
  let ethSettlementStrategyId: ethers.BigNumber;
  let liquidateTxn: ethers.providers.TransactionResponse;

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
            snxUSDAmount: () => bn(100_000),
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
    await systems().PerpsMarket.setLiquidationRewardGuards(1, bn(10));
  });

  before('set liquidation reward ratio', async () => {
    const initialMarginFraction = bn(0);
    const maintenanceMarginScalar = bn(0);
    const minimumInitialMarginRatio = bn(0);
    const liquidationRewardRatio = bn(0.05); // 100 * 0.05 = 5
    const minimumPositionMargin = bn(0);
    // max liquidation
    const maxLiquidationLimitAccumulationMultiplier = bn(1);
    const maxSecondsInLiquidationWindow = ethers.BigNumber.from(10);
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
      .setMaxLiquidationParameters(
        ethMarketId,
        maxLiquidationLimitAccumulationMultiplier,
        maxSecondsInLiquidationWindow,
        0,
        ethers.constants.AddressZero
      );
  });
  /**
   * Based on the above configuration, the max liquidation amount for window == 100
   * * (maker + taker) * skewScale * secondsInWindow * multiplier
   * * 0.01 * 1_000 * 10 * 1 = 100_000
   */

  let latestLiquidationTime: number;

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
      sizeDelta: bn(201),
      settlementStrategyId: ethSettlementStrategyId,
      price: bn(1000),
    });
  });

  before('lower price to liquidation', async () => {
    await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(1));
  });

  it('liquidate account - 1st step (100 of 201)', async () => {
    // calls liquidate on the perps market, 1st step => will flag and will liquidate 100 of original 201
    liquidateTxn = await systems().PerpsMarket.connect(keeper()).liquidate(2);
    latestLiquidationTime = await getTxTime(provider(), liquidateTxn);

    // emits position liquidated event
    await assertEvent(
      liquidateTxn,
      `PositionLiquidated(2, 25, ${bn(100)}, ${bn(101)})`,
      systems().PerpsMarket
    );

    // emits account liquidated event.
    // includes the flag reward + flag cost + 1 liquidation cost
    const expected = bn(5).add(KeeperCosts.flagCost + KeeperCosts.liquidateCost);

    await assertEvent(
      liquidateTxn,
      `AccountLiquidated(2, ${expected}, false)`, // not capped
      systems().PerpsMarket
    );
  });

  it('liquidate account - 2nd step (100 of 101)', async () => {
    await fastForwardTo(latestLiquidationTime + 35, provider());

    // calls liquidate on the perps market, 2nd step => won't flag and will liquidate 100 of original 201
    liquidateTxn = await systems().PerpsMarket.connect(keeper()).liquidate(2);
    latestLiquidationTime = await getTxTime(provider(), liquidateTxn);

    // emits position liquidated event
    await assertEvent(
      liquidateTxn,
      `PositionLiquidated(2, 25, ${bn(100)}, ${bn(1)})`,
      systems().PerpsMarket
    );

    // emits account liquidated event
    // since it was flagged it only gets 1 liquidation txn cost
    const expected = KeeperCosts.liquidateCost;

    await assertEvent(
      liquidateTxn,
      `AccountLiquidated(2, ${expected}, false)`, // not capped
      systems().PerpsMarket
    );
  });

  it('liquidate account - last step (1 of 1)', async () => {
    await fastForwardTo(latestLiquidationTime + 35, provider());

    // calls liquidate on the perps market, 3rd step => won't flag and will liquidate 1 of original 201
    liquidateTxn = await systems().PerpsMarket.connect(keeper()).liquidate(2);

    // emits position liquidated event
    await assertEvent(
      liquidateTxn,
      `PositionLiquidated(2, 25, ${bn(1)}, ${bn(0)})`,
      systems().PerpsMarket
    );

    // emits account liquidated event
    // since it was flagged it only gets 1 liquidation txn cost
    const expected = KeeperCosts.liquidateCost;

    await assertEvent(
      liquidateTxn,
      `AccountLiquidated(2, ${expected}, true)`, // not capped
      systems().PerpsMarket
    );
  });
});
