import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import {
  commitAndSettle,
  depositMargin,
  fastForwardBySec,
  findEventSafe,
  setMarketConfigurationById,
  withExplicitEvmMine,
  withdrawAllCollateral,
} from '../../helpers';
import { wei } from '@synthetixio/wei';

describe('PerpAccountModule', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, systems, provider, restore, collaterals } = bs;

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

      const { position } = await PerpMarketProxy.getAccountDigest(
        trader.accountId,
        market.marketId()
      );
      assertBn.isZero(position.size);
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

  describe('mergeAccounts', () => {
    it('should revert if either account does not exist');
    it('should revert if either account missing permission');
    it('should revert if market does not exist');
    it('should revert if collateral and market use different oracle');
    it('should revert if either of the positions have size 0');
    it('should revert if either of the collateral is 0');
    it('should revert if either of the positions can be liquidated');
    it('should revert if the new position is below initial margin requirement');
    it('should revert if trader have collateral other than passed id');
    it('should merge two accounts', async () => {
      const { PerpMarketProxy } = systems();
      // Create two trader object with different accountIds but same signer.
      const fromTrader = traders()[0];

      const toTraderAccountId = 42069;

      await PerpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
      const toTrader = {
        signer: fromTrader.signer,
        accountId: wei(toTraderAccountId).toNumber(),
      };

      const collateral = collaterals()[1];
      const market = genOneOf(markets());

      // Set the market oracleNodeId to the collateral oracleNodeId
      await setMarketConfigurationById(bs, market.marketId(), {
        oracleNodeId: collateral.oracleNodeId(),
      });
      market.oracleNodeId = collateral.oracleNodeId;
      // Also make sure price align on the aggregator
      const collateralPrice = await collateral.getPrice();
      await market.aggregator().mockSetCurrentPrice(collateralPrice);

      // Reset any preexisting collateral.
      await withdrawAllCollateral(bs, fromTrader, market.marketId());
      await withdrawAllCollateral(bs, toTrader, market.marketId());

      const { marketId, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: fromTrader,
          desiredCollateral: collateral,
          desiredMarket: market,
        })
      );

      const fromOrder = await genOrder(bs, market, collateral, collateralDepositAmount);

      const { receipt: fromOrderReceipt } = await commitAndSettle(
        bs,
        marketId,
        fromTrader,
        fromOrder
      );

      const fromOrderEvent = findEventSafe(fromOrderReceipt, 'OrderSettled', PerpMarketProxy);

      const { collateralDepositAmount: collateralDepositAmountTo } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: toTrader,
          desiredCollateral: collateral,
          desiredMarket: market,
        })
      );
      const toOrder = await genOrder(bs, market, collateral, collateralDepositAmountTo);
      const { receipt: toOrderReceipt } = await commitAndSettle(bs, marketId, toTrader, toOrder);
      const toOrderEvent = findEventSafe(toOrderReceipt, 'OrderSettled', PerpMarketProxy);

      const fromDigestBefore = await PerpMarketProxy.getAccountDigest(
        fromTrader.accountId,
        marketId
      );
      const toDigestBefore = await PerpMarketProxy.getAccountDigest(toTrader.accountId, marketId);

      assertBn.notEqual(fromDigestBefore.collateralUsd, 0);
      assertBn.notEqual(toDigestBefore.collateralUsd, 0);
      assertBn.notEqual(fromDigestBefore.position.size, 0);
      assertBn.notEqual(toDigestBefore.position.size, 0);

      const newCollateralPrice = wei(collateralPrice).mul(genNumber(0.9, 1.1)).toBN();
      await market.aggregator().mockSetCurrentPrice(newCollateralPrice);

      await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(fromTrader.signer).mergeAccounts(
            fromTrader.accountId,
            toTrader.accountId,
            marketId,
            collateral.synthMarketId()
          ),
        provider()
      );

      const fromDigestAfter = await PerpMarketProxy.getAccountDigest(
        fromTrader.accountId,
        marketId
      );
      const toDigestAfter = await PerpMarketProxy.getAccountDigest(toTrader.accountId, marketId);

      assertBn.isZero(fromDigestAfter.collateralUsd);
      assertBn.isZero(fromDigestAfter.position.size);
      assertBn.isZero(fromDigestAfter.debtUsd);

      const fromPotentialWinnings = wei(fromOrderEvent.args.pnl).add(
        fromOrderEvent.args.accruedFunding
      );
      const toPotentialWinnings = wei(toOrderEvent.args.pnl).add(toOrderEvent.args.accruedFunding);

      const newCollateral = fromDigestBefore.collateralUsd
        .add(toDigestBefore.collateralUsd)
        .add(fromPotentialWinnings.toBN())
        .add(toPotentialWinnings.toBN());

      assertBn.equal(newCollateral, toDigestAfter.collateralUsd);
      assertBn.equal(
        fromDigestBefore.position.size.add(toDigestBefore.position.size),
        toDigestAfter.position.size
      );
    });
    it('should merge accounts with debt and winning/losing position');
  });
});
