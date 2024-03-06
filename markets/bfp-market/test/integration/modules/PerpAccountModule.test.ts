import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf } from '../../generators';
import { fastForwardBySec } from '../../helpers';

describe('PerpAccountModule', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('getAccountDigest', async () => {
    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const market = genOneOf(markets());
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.getAccountDigest(invalidAccountId, market.marketId()),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const invalidMarketId = bn(genNumber(42069, 50_000));

      await assertRevert(
        PerpMarketProxy.getAccountDigest(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should return default object when accountId/marketId exists but no positions/orders are open', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const market = genOneOf(markets());

      const digest = await PerpMarketProxy.getAccountDigest(trader.accountId, market.marketId());

      assertBn.isZero(digest.order.sizeDelta);
      assertBn.isZero(digest.position.size);
    });
  });

  describe('getPositionDigest', () => {
    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const market = genOneOf(markets());
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.getPositionDigest(invalidAccountId, market.marketId()),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const invalidMarketId = bn(genNumber(42069, 50_000));

      await assertRevert(
        PerpMarketProxy.getPositionDigest(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should return default object when accountId/marketId exists but no position', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const market = genOneOf(markets());

      const digest = await PerpMarketProxy.getPositionDigest(trader.accountId, market.marketId());
      assertBn.isZero(digest.size);
    });

    describe('accruedFunding', () => {
      it('should accrue funding when position is opposite of skew');

      it('should pay funding when position is same side as skew');

      it('should not accrue or pay funding when size is 0', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());

        const d1 = await PerpMarketProxy.getPositionDigest(trader.accountId, market.marketId());
        assertBn.isZero(d1.size);

        await fastForwardBySec(provider(), genNumber(60 * 60, 60 * 60 * 24));

        const d2 = await PerpMarketProxy.getPositionDigest(trader.accountId, market.marketId());
        assertBn.isZero(d2.size);
      });
    });

    describe('{im,mm}', () => {});
  });
});
