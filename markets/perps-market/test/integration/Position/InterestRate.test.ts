import { DEFAULT_SETTLEMENT_STRATEGY, PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

const _SECONDS_IN_DAY = 24 * 60 * 60;

const _SKEW_SCALE = bn(10_000);
const _MAX_FUNDING_VELOCITY = bn(3);
const _TRADER_SIZE = bn(20);
const _ETH_PRICE = bn(2000);

describe.only('Position - interest rates', () => {
  const { systems, perpsMarkets, provider, trader1, trader2, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: _ETH_PRICE,
        fundingParams: { skewScale: _SKEW_SCALE, maxFundingVelocity: bn(3) },
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
    ({ settleTime: openPositionTime } = await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: _TRADER_SIZE,
      settlementStrategyId: ethMarket.strategyId(),
      price: bn(2000),
    }));
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

  it('works', async () => {
    console.log(await systems().PerpsMarket.size(ethMarket.marketId()));
    console.log(await systems().Core.getWithdrawableMarketUsd(ethMarket.marketId()));
  });
});
