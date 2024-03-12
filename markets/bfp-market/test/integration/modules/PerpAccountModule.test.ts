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
  withdrawAllCollateral,
} from '../../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

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
    it('should revert if trader have collateral other than passed id');
    it('should revert if toAccount position can be liquidated');
    it('should revert if toAccount position has an open order');
    it('should revert if fromAccount position entryTime is not block.timestamp');
    it('should revert if the new position is below initial margin requirement');

    it('should merge two accounts', async () => {
      const { PerpMarketProxy, MergeAccountSettlementHookMock } = systems();
      // Create two trader objects with different accountIds but same signer.
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
      await collateral.setPrice(collateralPrice);

      // Withdraw any preexisting collateral.
      await withdrawAllCollateral(bs, fromTrader, market.marketId());

      const { collateralDepositAmount: collateralDepositAmountTo, marketId } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: toTrader,
          desiredCollateral: collateral,
          desiredMarket: market,
        })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmountTo);
      await commitAndSettle(bs, marketId, toTrader, order);

      // Create some debt for the toAccount, so we later can assert it's realized on account merge.
      await collateral.setPrice(
        wei(collateralPrice)
          .mul(order.sizeDelta.gt(0) ? 0.9 : 1.1)
          .toBN()
      );

      const toOrder = await genOrder(bs, market, collateral, collateralDepositAmountTo, {
        desiredSize: wei(order.sizeDelta).mul(0.9).toBN(), // decrease position slightly
      });
      await commitAndSettle(bs, marketId, toTrader, toOrder);
      // Reset the price causing the toAccount's position to have some pnl.
      await collateral.setPrice(collateralPrice);

      // Start creating from position.
      const { collateralDepositAmount: collateralDepositAmountFrom } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: fromTrader,
          desiredCollateral: collateral,
          desiredMarket: market,
        })
      );
      // Set the from account to be the "vaultAccountId" that will have the new account merged into it.
      await MergeAccountSettlementHookMock.mockSetVaultAccountId(toTrader.accountId);

      // Make sure the settlement hook have permission to merge both the accounts (PERPS_MODIFY_COLLATERAL).
      // In a real world scenario the vault/settlement hook would own both of these account.
      await PerpMarketProxy.connect(toTrader.signer).grantPermission(
        toTrader.accountId,
        ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL'),
        MergeAccountSettlementHookMock.address
      );
      await PerpMarketProxy.connect(toTrader.signer).grantPermission(
        fromTrader.accountId,
        ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL'),
        MergeAccountSettlementHookMock.address
      );

      const fromDigestBefore = await PerpMarketProxy.getAccountDigest(
        fromTrader.accountId,
        marketId
      );
      const toDigestBefore = await PerpMarketProxy.getAccountDigest(toTrader.accountId, marketId);
      const marketDigestBefore = await PerpMarketProxy.getMarketDigest(marketId);
      // Assert that the accounts have some collateral.
      assertBn.gt(fromDigestBefore.collateralUsd, 0);
      assertBn.gt(toDigestBefore.collateralUsd, 0);
      // The toAccount should also have some debt and an open position.
      assertBn.gt(toDigestBefore.debtUsd, 0);
      assertBn.notEqual(toDigestBefore.position.size, 0);

      // Create an order with the MergeAccountSettlementHookMock as a hook.
      const fromOrder = await genOrder(bs, market, collateral, collateralDepositAmountFrom, {
        desiredLeverage: 1,
        desiredSide: 1,
        desiredHooks: [MergeAccountSettlementHookMock.address],
      });

      const { receipt: fromOrderReceipt } = await commitAndSettle(
        bs,
        marketId,
        fromTrader,
        fromOrder
      );

      const fromOrderEvent = findEventSafe(fromOrderReceipt, 'OrderSettled', PerpMarketProxy);

      const fromDigestAfter = await PerpMarketProxy.getAccountDigest(
        fromTrader.accountId,
        marketId
      );
      const toDigestAfter = await PerpMarketProxy.getAccountDigest(toTrader.accountId, marketId);
      const marketDigestAfter = await PerpMarketProxy.getMarketDigest(marketId);

      assertBn.isZero(fromDigestAfter.collateralUsd);
      assertBn.isZero(fromDigestAfter.position.size);
      assertBn.isZero(fromDigestAfter.debtUsd);

      // Before the form position gets merged into the to position, we should be realising the to position.
      const profitsFromRealizingPosition = toDigestBefore.position.pnl
        .add(toDigestBefore.position.accruedFunding)
        .sub(toDigestBefore.position.accruedFeesUsd)
        .sub(toDigestBefore.position.accruedUtilization);

      const expectedDebt = Wei.max(
        wei(0),
        wei(toDigestBefore.debtUsd).sub(profitsFromRealizingPosition)
      ).toBN();
      const expectedUsdCollateral = Wei.max(
        wei(0),
        wei(profitsFromRealizingPosition).sub(toDigestBefore.debtUsd)
      ).toBN();

      // Assert global tracking  (totalTraderDebtUsd and totalCollateralValueUsd)
      assertBn.near(
        marketDigestBefore.totalTraderDebtUsd.sub(toDigestBefore.debtUsd).add(expectedDebt),
        marketDigestAfter.totalTraderDebtUsd,
        bn(0.0001)
      );
      assertBn.near(
        marketDigestBefore.totalCollateralValueUsd.add(expectedUsdCollateral),
        marketDigestAfter.totalCollateralValueUsd,
        bn(0.0001)
      );
      // Assert the to account got realized correctly
      assertBn.near(expectedDebt, toDigestAfter.debtUsd, bn(0.0001));
      assertBn.equal(fromDigestAfter.position.size, 0);
      assertBn.near(
        fromDigestBefore.collateralUsd.add(toDigestBefore.collateralUsd).add(expectedUsdCollateral),
        toDigestAfter.collateralUsd,
        bn(0.0001)
      );
      assertBn.equal(
        fromOrderEvent.args.sizeDelta.add(toDigestBefore.position.size),
        toDigestAfter.position.size
      );

      // Assert event
      await assertEvent(
        fromOrderReceipt,
        `AccountMerged(${fromTrader.accountId}, ${toTrader.accountId}, ${marketId})`,
        PerpMarketProxy
      );
    });
  });
});
