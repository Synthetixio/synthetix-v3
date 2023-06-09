import { ethers } from 'ethers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import assert from 'assert';
import { depositCollateral } from '../helpers';

describe('PerpsMarketModule', () => {
  const fixture = {
    skewScale: bn(10_000),
    maxFundingVelocity: bn(0.5),
    maxMarketValue: bn(100_000),
    marketTokenPrice: bn(1000),
  };

  const { systems, provider, synthMarkets, perpsMarkets, signers, restore } = bootstrapMarkets({
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

  let marketId: ethers.BigNumber, trader1: ethers.Signer, trader2: ethers.Signer;

  before('identify actors', () => {
    [, , , trader1, trader2] = signers();
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
      assertBn.equal(summary.fillPrice, fixture.marketTokenPrice);
    });
  });

  describe('Pagination', () => {
    beforeEach(() => restore());

    beforeEach('add collateral', async () => {
      const traders = [
        { trader: trader1, accountId: 1 },
        { trader: trader2, accountId: 2 },
      ];
      for (const { accountId, trader } of traders) {
        await depositCollateral(
          {
            trader: () => trader,
            accountId: () => accountId,
            trades: [
              {
                synthName: () => 'snxUSD',
                synthMarketId: () => 0,
                synthMarket: () => synthMarkets()[0].synth(),
                marginAmount: () => bn(10_000),
                synthAmount: () => bn(10_000),
              },
            ],
          },
          { systems, provider }
        );
      }
    });

    describe('getAsyncOrdersPaginated', () => {
      it('should return an empty list of orders when none exist', async () => {
        const { orders, nextCursor } = await systems().PerpsMarket.getAsyncOrdersPaginated(
          marketId,
          0,
          10
        );
        assert.deepEqual(orders, []);
        assertBn.equal(nextCursor, bn(0));
      });

      it('should paginate correctly', async () => {
        // Commit multiple (2) orders across different accountIds.
        const tx1 = await systems()
          .PerpsMarket.connect(trader1)
          .commitOrder({
            marketId: marketId,
            accountId: 1,
            sizeDelta: bn(0.5),
            settlementStrategyId: 0,
            acceptablePrice: fixture.marketTokenPrice,
            trackingCode: ethers.constants.HashZero,
          });
        await tx1.wait();
        const tx2 = await systems()
          .PerpsMarket.connect(trader2)
          .commitOrder({
            marketId: marketId,
            accountId: 2,
            sizeDelta: bn(0.5),
            settlementStrategyId: 0,
            acceptablePrice: fixture.marketTokenPrice,
            trackingCode: ethers.constants.HashZero,
          });
        await tx2.wait();

        // Use a small enough page size to support multiple pages (2).
        const pageSize = 1;

        // Page 1
        const { orders: orders1, nextCursor: nextCursor1 } =
          await systems().PerpsMarket.getAsyncOrdersPaginated(marketId, 0, pageSize);
        assert.equal(orders1.length, 1);
        assert.equal(nextCursor1, 1);

        // Page 2
        const { orders: orders2, nextCursor: nextCursor2 } =
          await systems().PerpsMarket.getAsyncOrdersPaginated(marketId, nextCursor1, pageSize);
        assert.equal(orders2.length, 1);
        assert.equal(nextCursor2, 2);

        // Page 3 (empty)
        const { orders: orders3, nextCursor: nextCursor3 } =
          await systems().PerpsMarket.getAsyncOrdersPaginated(marketId, nextCursor2, pageSize);
        assert.equal(orders3.length, 0);
        assert.equal(nextCursor3, 2);
      });

      it('should return one page with one order', async () => {
        const tx = await systems()
          .PerpsMarket.connect(trader1)
          .commitOrder({
            marketId: marketId,
            accountId: 1,
            sizeDelta: bn(0.5),
            settlementStrategyId: 0,
            acceptablePrice: fixture.marketTokenPrice,
            trackingCode: ethers.constants.HashZero,
          });
        await tx.wait();
        const { orders, nextCursor } = await systems().PerpsMarket.getAsyncOrdersPaginated(
          marketId,
          0,
          10
        );
        assert.equal(orders.length, 1);
        assert.equal(nextCursor, 1);
      });

      it('should return an empty list when cursor is above length', async () => {
        const tx = await systems()
          .PerpsMarket.connect(trader1)
          .commitOrder({
            marketId: marketId,
            accountId: 1,
            sizeDelta: bn(0.5),
            settlementStrategyId: 0,
            acceptablePrice: fixture.marketTokenPrice,
            trackingCode: ethers.constants.HashZero,
          });
        await tx.wait();
        const { orders, nextCursor } = await systems().PerpsMarket.getAsyncOrdersPaginated(
          marketId,
          1,
          10
        );
        assert.deepEqual(orders, []);
        assert.equal(nextCursor, 1);
      });

      it('should return an empty list when desired amount is 0', async () => {
        const market = systems().PerpsMarket;
        const { orders: orders1 } = await market.getAsyncOrdersPaginated(marketId, 0, 0);
        assert.deepEqual(orders1, []);

        const tx = await systems()
          .PerpsMarket.connect(trader1)
          .commitOrder({
            marketId: marketId,
            accountId: 1,
            sizeDelta: bn(0.5),
            settlementStrategyId: 0,
            acceptablePrice: fixture.marketTokenPrice,
            trackingCode: ethers.constants.HashZero,
          });
        await tx.wait();

        const { orders: orders2 } = await market.getAsyncOrdersPaginated(marketId, 0, 0);
        assert.deepEqual(orders2, []);
      });
    });
  });
});
