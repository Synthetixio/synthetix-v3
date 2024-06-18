import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import { commitAndSettle, commitOrder, depositMargin, withExplicitEvmMine } from '../../helpers';
import { wei } from '@synthetixio/wei';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('PerpAccountModule splitAccount', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, owner, systems, restore, provider } = bs;

  beforeEach(restore);

  it('should revert when fromAccount does not exist/has missing permission', async () => {
    const { BfpMarketProxy } = systems();

    const invalidAccountId = 42069;
    const marketId = 1;
    const toTrader = genOneOf(traders());

    await assertRevert(
      BfpMarketProxy.splitAccount(invalidAccountId, toTrader.accountId, marketId, bn(0.1)),
      `PermissionDenied`,
      BfpMarketProxy
    );
  });

  it('should revert when toAccount does not exist/has missing permission', async () => {
    const { BfpMarketProxy } = systems();

    const invalidAccountId = 42069;
    const marketId = 1;
    const fromTrader = genOneOf(traders());

    await assertRevert(
      BfpMarketProxy.splitAccount(fromTrader.accountId, invalidAccountId, marketId, bn(0.1)),
      `PermissionDenied`,
      BfpMarketProxy
    );
  });

  it('should revert when toId and fromId are the same', async () => {
    const { BfpMarketProxy } = systems();
    const fromTrader = genOneOf(traders());

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        fromTrader.accountId,
        1
      ),
      `DuplicateAccountIds`,
      BfpMarketProxy
    );
  });

  it('should revert is caller is not whitelisted', async () => {
    const { BfpMarketProxy } = systems();

    const invalidAccountId = 42069;
    const marketId = 1;
    const fromTrader = genOneOf(traders());
    // Ensure we don't have any whitelisted accounts.
    await withExplicitEvmMine(() => BfpMarketProxy.setEndorsedSplitAccounts([]), provider());

    await assertRevert(
      BfpMarketProxy.splitAccount(fromTrader.accountId, invalidAccountId, marketId, bn(0.1)),
      `PermissionDenied`,
      BfpMarketProxy
    );
  });

  it('should revert when fromAccount does not exist/has missing permission', async () => {
    const { BfpMarketProxy } = systems();

    const invalidAccountId = 42069;
    const marketId = 1;
    const toTrader = genOneOf(traders());

    await assertRevert(
      BfpMarketProxy.splitAccount(invalidAccountId, toTrader.accountId, marketId, bn(0.1)),
      `PermissionDenied`,
      BfpMarketProxy
    );
  });

  it('should revert if proportion is bigger than 1', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    await BfpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const market = genOneOf(markets());

    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTraderAccountId,
        market.marketId(),
        bn(genNumber(1.1, 2))
      ),
      `AccountSplitProportionTooLarge()`,
      BfpMarketProxy
    );
  });

  it('should revert if proportion is 0', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    await BfpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const market = genOneOf(markets());

    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTraderAccountId,
        market.marketId(),
        bn(0)
      ),
      `ZeroProportion()`,
      BfpMarketProxy
    );
  });

  it('should revert when market does not exist', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    await BfpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const invalidMarketId = 69420;

    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTraderAccountId,
        invalidMarketId,
        bn(genNumber(0.1, 1))
      ),
      `MarketNotFound("${invalidMarketId}")`,
      BfpMarketProxy
    );
  });

  it('should revert when any account have an order open', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
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
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 1))
      ),
      `OrderFound()`,
      BfpMarketProxy
    );
  });

  it('should revert if fromAccount missing position', async () => {
    const { BfpMarketProxy } = systems();

    const { trader: fromTrader, marketId } = await depositMargin(bs, genTrader(bs));
    const toTraderAccountId = 42069;

    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTraderAccountId,
        marketId,
        bn(genNumber(0.1, 1))
      ),
      `PositionNotFound()`,
      BfpMarketProxy
    );
  });

  it('should revert when toAccount has collateral', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const { market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: fromTrader })
    );
    await commitAndSettle(
      bs,
      marketId,
      fromTrader,
      genOrder(bs, market, collateral, collateralDepositAmount)
    );
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    await depositMargin(bs, genTrader(bs, { desiredTrader: toTrader, desiredMarket: market }));
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 1))
      ),
      `CollateralFound()`,
      BfpMarketProxy
    );
  });

  it('should revert when toAccount has debt', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
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

    // Assign debt to the toAccount.
    await BfpMarketProxy.connect(owner()).__test_addDebtUsdToAccountMargin(
      toTraderAccountId,
      marketId,
      bn(1)
    );
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 1))
      ),
      `CollateralFound()`,
      BfpMarketProxy
    );
  });

  it('should revert when toAccount have a position', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
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
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 1))
      ),
      `PositionFound("${toTrader.accountId}", "${marketId}")`,
      BfpMarketProxy
    );
  });

  it('should revert when fromAccount is flagged', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
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
      () => BfpMarketProxy.flagPosition(fromTrader.accountId, marketId),
      provider()
    );
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 0.99))
      ),
      'PositionFlagged()',
      BfpMarketProxy
    );
  });

  it('should revert when fromAccount is liquidatable', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const { marketId, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: fromTrader })
    );
    const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 9,
    });
    await commitAndSettle(bs, marketId, fromTrader, openOrder);

    const tx = await market.aggregator().mockSetCurrentPrice(
      wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.5 : 1.5)
        .toBN()
    );
    await tx.wait();
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        bn(genNumber(0.1, 0.99))
      ),
      'CanLiquidatePosition()',
      BfpMarketProxy
    );
  });

  it('should revert if fromAccount not passing IM', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const { marketId, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: fromTrader })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitAndSettle(bs, marketId, fromTrader, order);

    const proportion = bn(0.9999);
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).splitAccount(
        fromTrader.accountId,
        toTrader.accountId,
        marketId,
        proportion
      ),
      'InsufficientMargin()',
      BfpMarketProxy
    );
  });

  it('should split account', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
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
    const fromAccountDigestBefore = await BfpMarketProxy.getAccountDigest(
      fromTrader.accountId,
      marketId
    );
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );
    const { receipt } = await withExplicitEvmMine(
      () =>
        BfpMarketProxy.connect(fromTrader.signer).splitAccount(
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
      BfpMarketProxy
    );
    const fromAccountDigestAfter = await BfpMarketProxy.getAccountDigest(
      fromTrader.accountId,
      marketId
    );
    const toAccountDigestAfter = await BfpMarketProxy.getAccountDigest(
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
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(toTrader.signer)['createAccount(uint128)'](toTraderAccountId);
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
    const fromAccountDigestBefore = await BfpMarketProxy.getAccountDigest(
      fromTrader.accountId,
      marketId
    );
    await withExplicitEvmMine(
      async () => BfpMarketProxy.setEndorsedSplitAccounts([await fromTrader.signer.getAddress()]),
      provider()
    );
    const { receipt } = await withExplicitEvmMine(
      () =>
        BfpMarketProxy.connect(fromTrader.signer).splitAccount(
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
      BfpMarketProxy
    );
    const fromAccountDigestAfter = await BfpMarketProxy.getAccountDigest(
      fromTrader.accountId,
      marketId
    );
    const toAccountDigestAfter = await BfpMarketProxy.getAccountDigest(
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

    // Position should be cleared.
    assertBn.isZero(fromAccountDigestAfter.position.size);
    assertBn.isZero(fromAccountDigestAfter.position.entryPrice);
    assertBn.isZero(fromAccountDigestAfter.position.accruedFunding);
    assertBn.isZero(fromAccountDigestAfter.position.accruedUtilization);
  });
});
