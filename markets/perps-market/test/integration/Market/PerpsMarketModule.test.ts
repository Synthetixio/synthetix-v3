import { ethers } from 'ethers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, openPosition } from '../helpers';
import { formatEther } from 'ethers/lib/utils';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('PerpsMarketModule', () => {
  const fixture = {
    skewScale: bn(10_000),
    maxFundingVelocity: bn(0.5),
    maxMarketValue: bn(100_000),
    marketTokenPrice: bn(1000),
  };

  const { systems, perpsMarkets, synthMarkets, marketOwner, provider, trader2, keeper } =
    bootstrapMarkets({
      synthMarkets: [
        {
          name: 'Ether',
          token: 'snxETH',
          buyPrice: fixture.marketTokenPrice,
          sellPrice: fixture.marketTokenPrice,
        },
      ],
      perpsMarkets: [
        {
          name: 'Ether',
          token: 'snxETH',
          price: fixture.marketTokenPrice,
          fundingParams: {
            skewScale: fixture.skewScale,
            maxFundingVelocity: fixture.maxFundingVelocity,
          },
          maxMarketValue: fixture.maxMarketValue,
        },
      ],
      traderAccountIds: [1, 2],
    });

  let marketId: ethers.BigNumber;

  before('identify actors', () => {
    marketId = perpsMarkets()[0].marketId();
  });

  describe('getMarketSummary', () => {
    it('should return all values successfully', async () => {
      const summary = await systems().PerpsMarket.getMarketSummary(marketId);
      assertBn.equal(summary.skew, bn(0));
      assertBn.equal(summary.size, bn(0));
      assertBn.equal(summary.maxOpenInterest, fixture.maxMarketValue);
      assertBn.equal(summary.currentFundingRate, bn(0));
      assertBn.equal(summary.currentFundingVelocity, bn(0));
      assertBn.equal(summary.indexPrice, fixture.marketTokenPrice);
    });
  });

  describe('fillPrice', () => {
    describe('skewScale 0', () => {
      const restoreSkewScale = snapshotCheckpoint(provider);
      before('set skewScale to 0', async () => {
        await systems().PerpsMarket.connect(marketOwner()).setFundingParameters(marketId, 0, 0);
      });
      it('should return the index price', async () => {
        const price = await systems().PerpsMarket.fillPrice(marketId, bn(1), bn(1000));
        assertBn.equal(price, fixture.marketTokenPrice);
      });
      after('restore skewScale', restoreSkewScale);
    });
    let commonOpenPositionProps: Pick<
      OpenPositionData,
      | 'systems'
      | 'provider'
      | 'trader'
      | 'accountId'
      | 'keeper'
      | 'marketId'
      | 'settlementStrategyId'
    >;
    before('identify common props', async () => {
      commonOpenPositionProps = {
        systems,
        provider,
        marketId: marketId,
        trader: trader2(),
        accountId: 2,
        keeper: keeper(),
        settlementStrategyId: bn(0),
      };
    });
    const tests = [
      {
        marketSkew: 0,
        sizeAndExpectedPrice: [
          { size: 1, price: bn(1010), expectedPrice: bn(1010.0505) },
          { size: -1, price: bn(1010), expectedPrice: bn(1009.9495) },
        ],
      },
      {
        marketSkew: 10,
        sizeAndExpectedPrice: [
          { size: 1, price: bn(1010), expectedPrice: bn(1011.0605) },
          { size: -1, price: bn(1010), expectedPrice: bn(1010.9595) },
          { size: -11, price: bn(1010), expectedPrice: bn(1010.4545) },
        ],
      },
      {
        marketSkew: -10,
        sizeAndExpectedPrice: [
          { size: 1, price: bn(1010), expectedPrice: bn(1009.0405) },
          { size: -1, price: bn(1010), expectedPrice: bn(1008.9395) },
          { size: 11, price: bn(1010), expectedPrice: bn(1009.5455) },
        ],
      },
    ];
    before('add collateral', async () => {
      await systems().PerpsMarket.connect(trader2()).modifyCollateral(2, 0, bn(10000000));
    });

    tests.forEach(({ marketSkew, sizeAndExpectedPrice }) => {
      describe(`marketSkew ${marketSkew}`, () => {
        const restoreMarketSkew = snapshotCheckpoint(provider);
        before('create market skew', async () => {
          if (marketSkew === 0) return;
          await openPosition({
            ...commonOpenPositionProps,
            sizeDelta: bn(marketSkew),
            price: fixture.marketTokenPrice,
          });
        });
        sizeAndExpectedPrice.forEach(({ size, price, expectedPrice }) => {
          it(`fillPrice for size ${size} and price ${formatEther(price)}`, async () => {
            const fillPrice = await systems().PerpsMarket.fillPrice(marketId, bn(size), price);
            assertBn.equal(fillPrice, expectedPrice);
          });
        });
        after('restore market skew', restoreMarketSkew);
      });
    });
  });
});
