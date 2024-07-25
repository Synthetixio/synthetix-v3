import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import {
  commitAndSettle,
  commitOrder,
  depositMargin,
  getFastForwardTimestamp,
  getPythPriceDataByMarketId,
  getSusdCollateral,
  payDebt,
  setMarketConfiguration,
  withExplicitEvmMine,
} from '../../helpers';
import { wei } from '@synthetixio/wei';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('PerpAccountModule splitAccount', () => {
  const bs = bootstrap(genBootstrap());
  const { collaterals, markets, traders, owner, systems, restore, provider } = bs;

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
      `DuplicateEntries`,
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

  it('should revert if proportion is causing size to be 0 due to rounding', async () => {
    const { BfpMarketProxy } = systems();

    const sUSD = getSusdCollateral(collaterals());

    const market = markets()[1];
    const marketId = market.marketId();
    const trader0 = traders()[0];
    const trader1 = traders()[1];

    await setMarketConfiguration(bs, {
      minKeeperFeeUsd: bn(100),
      maxKeeperFeeUsd: bn(100),
    });

    // We want to split such that the from account is left with:
    // - 0 size
    // - nonzero collateral
    // - nonzer0 debt
    // Where the debt is nearly as much as the the collateral

    // If we allow this, the account would left in a margin liquidatable state
    // and the user can profit from the liquidation reward.

    // Even if this action were not profitable for the user, it
    // is draining value from the LPs and can be repeated without
    // bound. Hence we need this to revert.

    // Create the initial position
    const depositUsdAmount = 1000;
    await market.aggregator().mockSetCurrentPrice(bn(5000));

    const { collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: trader0,
        desiredMarket: market,
        desiredCollateral: sUSD,
        desiredMarginUsdDepositAmount: depositUsdAmount,
      })
    );
    const iniitialOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredSize: wei(0.99).toBN(),
      desiredKeeperFeeBufferUsd: 10,
      desiredPriceImpactPercentage: 0.5,
    });

    await commitAndSettle(bs, marketId, trader0, iniitialOrder);
    // Pay debt from the order fee so we can withdraw a bit
    await payDebt(bs, marketId, trader0);

    // Trader goes into profit and he can remove some of his collateral
    await market.aggregator().mockSetCurrentPrice(bn(6500));

    await BfpMarketProxy.connect(trader0.signer).modifyCollateral(
      trader0.accountId,
      marketId,
      sUSD.address(),
      bn(-750)
    );

    // Trader builds up debt by commiting an order and cancelling it
    // Trader can use a priceLimit such that the order is not filled
    const cancellableOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredSize: wei(0.99).toBN(),
      desiredKeeperFeeBufferUsd: 10,
      desiredPriceImpactPercentage: 0.5,
    });

    await commitOrder(bs, marketId, trader0, cancellableOrder);

    // Execution window passes
    const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader0);
    const config = await BfpMarketProxy.getMarketConfiguration();
    const staleTime = publishTime + 1 + config.maxOrderAge.toNumber();
    await fastForwardTo(staleTime, provider());
    const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    // Cancel the order
    await BfpMarketProxy.connect(trader1.signer).cancelOrder(
      trader0.accountId,
      marketId,
      updateData
    );

    // Whitelist trader0
    const trader0Address = await trader0.signer.getAddress();
    await BfpMarketProxy.setEndorsedSplitAccounts([trader0Address]);

    const toTraderAccountId = 777;
    const tx = await BfpMarketProxy.connect(trader0.signer)['createAccount(uint128)'](
      toTraderAccountId
    );
    await tx.wait();

    await assertRevert(
      BfpMarketProxy.connect(trader0.signer).splitAccount(
        trader0.accountId,
        toTraderAccountId,
        marketId,
        '1' // Split by 0.0000...001%
      ),
      'AccountSplitProportionTooSmall()',
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
