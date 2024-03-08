import { ethers } from 'ethers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, openPosition } from '../helpers';
import { wei } from '@synthetixio/wei';
import { calculateFillPrice } from '../helpers/fillPrice';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('PerpsMarketModule', () => {
  const fixture = {
    skewScale: bn(10_000),
    maxFundingVelocity: bn(0.5),
    maxMarketSize: bn(100_000),
    marketTokenPrice: bn(1000),
  };

  const { systems, perpsMarkets, owner, provider, trader2, keeper } = bootstrapMarkets({
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
        requestedMarketId: 50,
        name: 'Ether',
        token: 'snxETH',
        price: fixture.marketTokenPrice,
        fundingParams: {
          skewScale: fixture.skewScale,
          maxFundingVelocity: fixture.maxFundingVelocity,
        },
        maxMarketSize: fixture.maxMarketSize,
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
      assertBn.equal(summary.maxOpenInterest, fixture.maxMarketSize);
      assertBn.equal(summary.currentFundingRate, bn(0));
      assertBn.equal(summary.currentFundingVelocity, bn(0));
      assertBn.equal(summary.indexPrice, fixture.marketTokenPrice);
    });
  });

  describe('get market data', () => {
    it('should return all independent values successfully', async () => {
      const skew = await systems().PerpsMarket.skew(marketId);
      const size = await systems().PerpsMarket.size(marketId);
      const currentFundingRate = await systems().PerpsMarket.currentFundingRate(marketId);
      const currentFundingVelocity = await systems().PerpsMarket.currentFundingVelocity(marketId);
      assertBn.equal(skew, bn(0));
      assertBn.equal(size, bn(0));
      assertBn.equal(currentFundingRate, bn(0));
      assertBn.equal(currentFundingVelocity, bn(0));
    });
  });

  describe('fillPrice', () => {
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

    before('add collateral', async () => {
      await systems().PerpsMarket.connect(trader2()).modifyCollateral(2, 0, bn(10000000));
    });
    describe('skewScale 0', () => {
      const restoreSkewScale = snapshotCheckpoint(provider);
      before('set skewScale to 0', async () => {
        await systems().PerpsMarket.connect(owner()).setFundingParameters(marketId, 0, 0);
      });
      it('should return the index price', async () => {
        const price = await systems().PerpsMarket.fillPrice(marketId, bn(1), bn(1000));
        assertBn.equal(price, fixture.marketTokenPrice);
      });
      after('restore skewScale', restoreSkewScale);
    });

    const tests = [
      {
        marketSkew: 0,
        sizeAndPrice: [
          { size: 1, price: 1010 },
          { size: -1, price: 1010 },
        ],
      },
      {
        marketSkew: 10,
        sizeAndPrice: [
          { size: 1, price: 1010 },
          { size: -1, price: 1010 },
          { size: -11, price: 1010 },
        ],
      },
      {
        marketSkew: -10,
        sizeAndPrice: [
          { size: 1, price: 1010 },
          { size: -1, price: 1010 },
          { size: 11, price: 1010 },
        ],
      },
    ];
    tests.forEach(({ marketSkew, sizeAndPrice }) => {
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
        sizeAndPrice.forEach(({ size, price }) => {
          it(`fillPrice for size ${size} and price ${price}`, async () => {
            const fillPrice = await systems().PerpsMarket.fillPrice(marketId, bn(size), bn(price));
            const expectedFillPrice = calculateFillPrice(
              wei(marketSkew),
              wei(fixture.skewScale),
              wei(size),
              wei(price)
            ).toBN();

            assertBn.equal(fillPrice, expectedFillPrice);
          });
        });
        after('restore market skew', restoreMarketSkew);
      });
    });
  });
});
