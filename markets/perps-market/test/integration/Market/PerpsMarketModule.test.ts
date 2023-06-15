import { ethers } from 'ethers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';

describe('PerpsMarketModule', () => {
  const fixture = {
    skewScale: bn(10_000),
    maxFundingVelocity: bn(0.5),
    maxMarketValue: bn(100_000),
    marketTokenPrice: bn(1000),
  };

  const { systems, perpsMarkets, restore } = bootstrapMarkets({
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
    beforeEach(() => restore());

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
    it('should return correct value when passing same as onchain price', async () => {
      const price = await systems().PerpsMarket.fillPrice(marketId, bn(1), bn(1000));
      assertBn.equal(price, bn(1000.05));
    });
    it('should return correct value when passing different price', async () => {
      const price = await systems().PerpsMarket.fillPrice(marketId, bn(1), bn(1010));
      assertBn.equal(price, bn(1010.0505));
    });
  });
});
