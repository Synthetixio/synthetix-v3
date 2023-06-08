import { ethers } from 'ethers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';

describe('PerpsMarketModule', () => {
  const fixture = {
    skewScale: bn(10_000),
    maxFundingVelocity: bn(0.5),
    maxMarketValue: bn(100_000),
    marketTokenPrice: bn(1500),
  };

  const { systems, perpsMarkets, signers } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: fixture.marketTokenPrice }],
    traderAccountIds: [1, 2],
  });

  let marketOwner: ethers.Signer, marketId: ethers.BigNumber;

  before('identify actors', () => {
    [, , marketOwner, ,] = signers();
    marketId = perpsMarkets()[0].marketId();
  });

  before('set parameters', async () => {
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setFundingParameters(marketId, fixture.skewScale, fixture.maxFundingVelocity);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaxMarketValue(marketId, fixture.maxMarketValue);
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
      assertBn.equal(summary.fillPrice, fixture.marketTokenPrice);
    });
  });

  describe('Pagination', () => {
    describe('getAsyncOrdersPaginated', () => {
      it('should return an empty list of orders when none exist', async () => {});

      it('should return multiple pages when desired amount is < length', () => {});

      it('should return an empty list when cursor is above length', async () => {});

      it('should return an empty list when desired amount is 0', async () => {});

      it('should return an empty list when market does not exist', () => {});
    });
  });
});
