import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import { commitAndSettle, commitOrder, depositMargin, withExplicitEvmMine } from '../../helpers';
import { wei } from '@synthetixio/wei';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('PerpAccountModule splitAccount', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, systems, restore, provider } = bs;

  beforeEach(restore);

  it('should revert when fromAccount does not exist/has missing permission', async () => {
    const { PerpMarketProxy } = systems();

    const invalidAccountId = 42069;
    const marketId = 1;
    const toTrader = genOneOf(traders());

    await assertRevert(
      PerpMarketProxy.splitAccount(invalidAccountId, toTrader.accountId, marketId, bn(0.1)),
      `PermissionDenied`,
      PerpMarketProxy
    );
  });

  it('should revert when toAccount does not exist/has missing permission', async () => {
    const { PerpMarketProxy } = systems();

    const invalidAccountId = 42069;
    const marketId = 1;
    const fromTrader = genOneOf(traders());

    await assertRevert(
      PerpMarketProxy.splitAccount(fromTrader.accountId, invalidAccountId, marketId, bn(0.1)),
      `PermissionDenied`,
      PerpMarketProxy
    );
  });

  it('should revert if proportion is bigger than 1', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    await PerpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const market = genOneOf(markets());
    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTraderAccountId,
        market.marketId(),
        bn(genNumber(1.1, 2))
      ),
      `AccountSplitProportionTooLarge()`,
      PerpMarketProxy
    );
  });

  it('should revert if proportion is 0', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    await PerpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const market = genOneOf(markets());
    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTraderAccountId,
        market.marketId(),
        bn(0)
      ),
      `ZeroProportion()`,
      PerpMarketProxy
    );
  });

  it('should revert when market does not exist', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    await PerpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const invalidMarketId = 69420;
    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTraderAccountId,
        invalidMarketId,
        bn(genNumber(0.1, 1))
      ),
      `MarketNotFound("${invalidMarketId}")`,
      PerpMarketProxy
    );
  });

  it('should revert when any account have an order open', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await PerpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const traderWithOrder = genOneOf([fromTrader, toTrader]);
    const { market, collateral, marketId, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: traderWithOrder,
      })
    );
    await commitOrder(
      bs,
      marketId,
      traderWithOrder,
      genOrder(bs, market, collateral, collateralDepositAmount)
    );
    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 1))
      ),
      `OrderFound()`,
      PerpMarketProxy
    );
  });

  it('should revert when toAccount has collateral', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await PerpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const { marketId } = await depositMargin(bs, genTrader(bs, { desiredTrader: toTrader }));

    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 1))
      ),
      `CollateralFound()`,
      PerpMarketProxy
    );
  });

  it('should revert when toAccount have a position', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await PerpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const { marketId, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: toTrader })
    );
    await commitAndSettle(
      bs,
      marketId,
      toTrader,
      genOrder(bs, market, collateral, collateralDepositAmount)
    );

    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 1))
      ),
      `PositionFound("${toTrader.accountId}", "${marketId}")`,
      PerpMarketProxy
    );
  });

  it('should revert when fromAccount is flagged', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await PerpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const { marketId, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: fromTrader })
    );
    const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 9,
    });
    await commitAndSettle(bs, marketId, fromTrader, openOrder);

    await market.aggregator().mockSetCurrentPrice(
      wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.5 : 1.5)
        .toBN()
    );
    await withExplicitEvmMine(
      () => PerpMarketProxy.flagPosition(fromTrader.accountId, marketId),
      provider()
    );
    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 0.99))
      ),
      'PositionFlagged()',
      PerpMarketProxy
    );
  });

  it('should revert when fromAccount is liquidatable', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await PerpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const { marketId, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: fromTrader })
    );
    const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 9,
    });
    await commitAndSettle(bs, marketId, fromTrader, openOrder);

    await market.aggregator().mockSetCurrentPrice(
      wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.5 : 1.5)
        .toBN()
    );

    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 0.99))
      ),
      'CanLiquidatePosition()',
      PerpMarketProxy
    );
  });

  it('should split account', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await PerpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const { marketId, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: fromTrader })
    );
    await commitAndSettle(
      bs,
      marketId,
      fromTrader,
      genOrder(bs, market, collateral, collateralDepositAmount)
    );

    const proportion = bn(genNumber(0.1, 0.99));
    const fromAccountDigestBefore = await PerpMarketProxy.getAccountDigest(
      fromTrader.accountId,
      marketId
    );

    const { receipt } = await withExplicitEvmMine(
      () =>
        PerpMarketProxy.connect(fromTrader.signer).splitAccount(
          fromTrader.accountId,
          toTrader.accountId,
          marketId,
          proportion
        ),
      provider()
    );

    await assertEvent(
      receipt,
      `AccountSplit(${fromTrader.accountId}, ${toTrader.accountId}, ${marketId})`,
      PerpMarketProxy
    );
    const fromAccountDigestAfter = await PerpMarketProxy.getAccountDigest(
      fromTrader.accountId,
      marketId
    );
    const toAccountDigestAfter = await PerpMarketProxy.getAccountDigest(
      toTrader.accountId,
      marketId
    );
    const debtChange = wei(fromAccountDigestBefore.debtUsd).mul(proportion).toBN();
    const collateralChange = wei(fromAccountDigestBefore.collateralUsd).mul(proportion).toBN();
    const sizeChange = wei(fromAccountDigestBefore.position.size).mul(proportion).toBN();

    // Assert to account.
    assertBn.near(toAccountDigestAfter.debtUsd, debtChange, bn(0.0001));
    assertBn.near(toAccountDigestAfter.collateralUsd, collateralChange, bn(0.0001));
    assertBn.near(toAccountDigestAfter.position.size, sizeChange, bn(0.0001));

    // Assert from account.
    assertBn.near(
      fromAccountDigestAfter.debtUsd,
      fromAccountDigestBefore.debtUsd.sub(debtChange),
      bn(0.0001)
    );
    assertBn.near(
      fromAccountDigestAfter.collateralUsd,
      fromAccountDigestBefore.collateralUsd.sub(collateralChange),
      bn(0.0001)
    );
    assertBn.near(
      fromAccountDigestAfter.position.size,
      fromAccountDigestBefore.position.size.sub(sizeChange),
      bn(0.0001)
    );
  });

  it('should split account with 1 proportion (concrete)', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await PerpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const { marketId, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: fromTrader })
    );
    await commitAndSettle(
      bs,
      marketId,
      fromTrader,
      genOrder(bs, market, collateral, collateralDepositAmount)
    );

    const proportion = bn(1);
    const fromAccountDigestBefore = await PerpMarketProxy.getAccountDigest(
      fromTrader.accountId,
      marketId
    );

    const { receipt } = await withExplicitEvmMine(
      () =>
        PerpMarketProxy.connect(fromTrader.signer).splitAccount(
          fromTrader.accountId,
          toTrader.accountId,
          marketId,
          proportion
        ),
      provider()
    );

    await assertEvent(
      receipt,
      `AccountSplit(${fromTrader.accountId}, ${toTrader.accountId}, ${marketId})`,
      PerpMarketProxy
    );
    const fromAccountDigestAfter = await PerpMarketProxy.getAccountDigest(
      fromTrader.accountId,
      marketId
    );
    const toAccountDigestAfter = await PerpMarketProxy.getAccountDigest(
      toTrader.accountId,
      marketId
    );
    const debtChange = wei(fromAccountDigestBefore.debtUsd).mul(proportion).toBN();
    const collateralChange = wei(fromAccountDigestBefore.collateralUsd).mul(proportion).toBN();
    const sizeChange = wei(fromAccountDigestBefore.position.size).mul(proportion).toBN();

    // Assert to account.
    assertBn.near(toAccountDigestAfter.debtUsd, debtChange, bn(0.0001));
    assertBn.near(toAccountDigestAfter.collateralUsd, collateralChange, bn(0.0001));
    assertBn.near(toAccountDigestAfter.position.size, sizeChange, bn(0.0001));

    // Assert from account.
    assertBn.isZero(fromAccountDigestAfter.debtUsd);
    assertBn.isZero(fromAccountDigestAfter.collateralUsd);
    assertBn.isZero(fromAccountDigestAfter.position.size);
  });
});
