import { ethers } from 'ethers';
import { PerpsMarket, bn, bootstrapMarkets, toNum } from '../bootstrap';
import { openPosition } from '../helpers';
import { fastForwardTo, getTxTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

const SECONDS_IN_DAY = 24 * 60 * 60;

describe.only('Position - funding', () => {
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
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(150_000));
  });

  let openPositionTime: number;
  before('open 20 eth position', async () => {
    const { settleTx } = await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: bn(20),
      settlementStrategyId: toNum(ethMarket.strategyId()),
      price: bn(2000),
    });
    // TODO: remove await settletx.wait()
    openPositionTime = await getTxTime(provider(), settleTx);
  });

  [
    {
      daysElapsed: 1,
      newOrderSize: bn(-60),
      expectedFundingVelocity: bn(-0.012),
      expectedFundingRate: bn(0.0006),
      expectedAccruedFunding: bn(120),
    },
  ].forEach(
    ({
      daysElapsed,
      newOrderSize,
      expectedFundingVelocity,
      expectedFundingRate,
      expectedAccruedFunding,
    }) => {
      describe(`after ${daysElapsed} days`, () => {
        before('move time', async () => {
          await fastForwardTo(openPositionTime + SECONDS_IN_DAY * daysElapsed, provider());
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
            settlementStrategyId: toNum(ethMarket.strategyId()),
            price: bn(2000),
          });
        });

        it('funding values are correct', async () => {
          const { currentFundingRate, currentFundingVelocity } =
            await systems().PerpsMarket.getMarketSummary(ethMarket.marketId());
          assertBn.equal(currentFundingRate, expectedFundingRate);
          assertBn.equal(currentFundingVelocity, expectedFundingVelocity);
        });

        it('funding accrued is correct', async () => {
          const [, accruedFunding] = await systems().PerpsMarket.getOpenPosition(
            2,
            ethMarket.marketId()
          );
          assertBn.equal(accruedFunding, expectedAccruedFunding);
        });
      });
    }
  );
});
