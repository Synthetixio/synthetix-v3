import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

const SECONDS_IN_DAY = 24 * 60 * 60;

describe('Position - funding', () => {
  const { systems, perpsMarkets, provider, trader1, trader2, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        name: 'Ether',
        token: 'snxETH',
        price: bn(2000),
        fundingParams: { skewScale: bn(10_000), maxFundingVelocity: bn(3) },
      },
    ],
    traderAccountIds: [2, 3],
  });

  let ethMarket: PerpsMarket;
  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
  });

  before('add collateral to margin', async () => {
    // trader accruing funding
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(50_000));
    // trader moving skew
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(1_000_000));
  });

  let openPositionTime: number;
  before('open 20 eth position', async () => {
    openPositionTime = await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: bn(20),
      settlementStrategyId: ethMarket.strategyId(),
      price: bn(2000),
    });
  });

  /*
    +------------------------------------------------------------------------------------+
    | Days elapsed |   Time   | Δ Skew | Skew | FR Velocity |    FR    | Accrued Funding |
    +------------------------------------------------------------------------------------+
    |      0       |    0     |   0    |  20  |    0.006    |    0     |       0         |
    |      1       |  86400   |  -60   | -40  |    -0.012   |  0.006   |      120        |
    |      1       | 172800   |   15   | -25  |   -0.0075   |  -0.006  |      120        |
    |     0.25     | 194400   |   37   |  12  |    0.0036   | -0.007875|     50.625      |
    |      2       | 367200   |  -17   |  -5  |   -0.0015   | -0.000675|    -291.375     |
    |     0.2      | 384480   |  155   | 150  |    0.045    | -0.000975|    -297.975     |
    |     0.1      | 393120   | -150   |   0  |      0      | 0.003525 |    -292.875     |
    |     0.1      | 401760   |  -15   | -15  |   -0.0045   | 0.003525 |    -278.775     |
    |     0.03     | 404352   |   -4   | -19  |   -0.0057   |  0.00339 |    -274.626     |
    |      3       | 663552   |   19   |   0  |      0      | -0.01371 |    -893.826     |
    +------------------------------------------------------------------------------------+
  */

  [
    { daysElapsed: 1, newOrderSize: bn(-60), expectedAccruedFunding: bn(-120) },
    { daysElapsed: 2, newOrderSize: bn(15), expectedAccruedFunding: bn(-120) },
    { daysElapsed: 2.25, newOrderSize: bn(37), expectedAccruedFunding: bn(-50.63) },
    { daysElapsed: 4.25, newOrderSize: bn(-17), expectedAccruedFunding: bn(291.38) },
    { daysElapsed: 4.45, newOrderSize: bn(155), expectedAccruedFunding: bn(297.98) },
    { daysElapsed: 4.55, newOrderSize: bn(-150), expectedAccruedFunding: bn(292.88) },
    { daysElapsed: 4.65, newOrderSize: bn(-15), expectedAccruedFunding: bn(278.78) },
    { daysElapsed: 4.68, newOrderSize: bn(-4), expectedAccruedFunding: bn(274.63) },
    { daysElapsed: 7.68, newOrderSize: bn(19), expectedAccruedFunding: bn(893.83) },
  ].forEach(({ daysElapsed, newOrderSize, expectedAccruedFunding }) => {
    describe(`after ${daysElapsed} days`, () => {
      before('move time', async () => {
        await fastForwardTo(openPositionTime - 8 + SECONDS_IN_DAY * daysElapsed, provider());
      });

      before('trader2 moves skew', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader2(),
          accountId: 3,
          keeper: trader2(),
          marketId: ethMarket.marketId(),
          sizeDelta: newOrderSize,
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(2000),
        });
      });

      it('funding accrued is correct', async () => {
        const [, accruedFunding] = await systems().PerpsMarket.getOpenPosition(
          2,
          ethMarket.marketId()
        );
        assertBn.near(accruedFunding, expectedAccruedFunding, bn(0.1));
      });
    });
  });
});
