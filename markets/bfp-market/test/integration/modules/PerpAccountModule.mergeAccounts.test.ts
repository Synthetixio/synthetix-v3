import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genOneOf, genOrder, genTrader } from '../../generators';
import {
  commitAndSettle,
  commitOrder,
  depositMargin,
  findEventSafe,
  getFastForwardTimestamp,
  getPythPriceDataByMarketId,
  setMarketConfigurationById,
  withdrawAllCollateral,
} from '../../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('PerpAccountModule mergeAccounts', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, systems, provider, restore, collaterals, keeper } = bs;

  beforeEach(restore);
  const createAccountsToMerge = async () => {
    const { PerpMarketProxy, MergeAccountSettlementHookMock } = systems();

    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await PerpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    // Set the from account to be the "vaultAccountId" that will have the new account merged into it.
    await MergeAccountSettlementHookMock.mockSetVaultAccountId(toTraderAccountId);

    // Make sure the settlement hook have permission to merge both the accounts (PERPS_MODIFY_COLLATERAL).
    // In a real world scenario the vault/settlement hook would own both of these account.
    await PerpMarketProxy.connect(fromTrader.signer).grantPermission(
      toTraderAccountId,
      ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL'),
      MergeAccountSettlementHookMock.address
    );
    await PerpMarketProxy.connect(fromTrader.signer).grantPermission(
      fromTrader.accountId,
      ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL'),
      MergeAccountSettlementHookMock.address
    );
    return { fromTrader, toTrader };
  };

  it('should revert if either account does not exist/ missing permission', async () => {
    const { PerpMarketProxy } = systems();

    const invalidAccountId = 42069;
    const validAccountId = genOneOf(traders()).accountId;

    await assertRevert(
      PerpMarketProxy.mergeAccounts(invalidAccountId, validAccountId, 1),
      `PermissionDenied`,
      PerpMarketProxy
    );
    await assertRevert(
      PerpMarketProxy.mergeAccounts(validAccountId, invalidAccountId, 1),
      `PermissionDenied`,
      PerpMarketProxy
    );
  });

  it('should revert if market does not exist', async () => {
    const { PerpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    await PerpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const invalidMarketId = 69420;
    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        toTraderAccountId,
        invalidMarketId
      ),
      `MarketNotFound("${invalidMarketId}")`,
      PerpMarketProxy
    );
  });
  it('should revert if fromAccount position entryTime is not block.timestamp', async () => {
    const { PerpMarketProxy } = systems();
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;

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
    const { marketId, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
      })
    );
    await PerpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);

    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitAndSettle(bs, marketId, fromTrader, order);

    await assertRevert(
      PerpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        toTraderAccountId,
        marketId
      ),
      `PositionTooOld()`,
      PerpMarketProxy
    );
  });
  it('should revert if collateral and market use different oracle', async () => {
    const { PerpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader } = await createAccountsToMerge();
    const { marketId, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredTrader: fromTrader })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 1,
      desiredHooks: [MergeAccountSettlementHookMock.address],
    });

    await commitOrder(bs, marketId, fromTrader, order);

    const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, fromTrader);
    await fastForwardTo(settlementTime, provider());

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    await assertRevert(
      PerpMarketProxy.connect(keeper()).settleOrder(fromTrader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `OracleNodeMismatch()`,
      PerpMarketProxy
    );
  });

  it('should revert if toAccount position has an open order', async () => {
    const { PerpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    const collateral = collaterals()[1];
    const market = genOneOf(markets());

    // Set the market oracleNodeId to the collateral oracleNodeId
    await setMarketConfigurationById(bs, market.marketId(), {
      oracleNodeId: collateral.oracleNodeId(),
    });
    market.oracleNodeId = collateral.oracleNodeId;

    // Deposit and commit an order for the toAccount which wont be settled.
    const { marketId, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: toTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
      })
    );
    await commitOrder(
      bs,
      marketId,
      toTrader,
      genOrder(bs, market, collateral, collateralDepositAmount)
    );

    // Deposit margin and commit and settle with settlement hook for the fromAccount.
    await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
      })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredHooks: [MergeAccountSettlementHookMock.address],
    });

    await commitOrder(bs, marketId, fromTrader, order);

    const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, fromTrader);
    await fastForwardTo(settlementTime, provider());

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    await assertRevert(
      PerpMarketProxy.connect(keeper()).settleOrder(fromTrader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `OrderFound()`,
      PerpMarketProxy
    );
  });

  it('should revert if toAccount position can be liquidated', async () => {
    const { PerpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    const collateral = collaterals()[1];
    const market = genOneOf(markets());

    // Set the market oracleNodeId to the collateral oracleNodeId
    await setMarketConfigurationById(bs, market.marketId(), {
      oracleNodeId: collateral.oracleNodeId(),
    });
    market.oracleNodeId = collateral.oracleNodeId;
    const collateralPrice = await collateral.getPrice();
    // Deposit and create a highly leveraged position
    const { marketId, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: toTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
      })
    );
    const toOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 9,
    });
    await commitAndSettle(bs, marketId, toTrader, toOrder);
    // Change price to make the toAccount liquidatable.
    const newPrice = wei(collateralPrice)
      .mul(toOrder.sizeDelta.gt(0) ? 0.8 : 1.2)
      .toBN();
    await collateral.setPrice(newPrice);

    // Deposit margin and commit and settle with settlement hook for the fromAccount.
    await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
      })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredHooks: [MergeAccountSettlementHookMock.address],
    });

    await commitOrder(bs, marketId, fromTrader, order);

    const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, fromTrader);
    await fastForwardTo(settlementTime, provider());

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    await assertRevert(
      PerpMarketProxy.connect(keeper()).settleOrder(fromTrader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `CanLiquidatePosition()`,
      PerpMarketProxy
    );
  });
  it('should revert if the new position is below initial margin requirement');

  it('should merge two accounts', async () => {
    const { PerpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();

    const collateral = collaterals()[1];
    const market = genOneOf(markets());

    // Set the market oracleNodeId to the collateral oracleNodeId
    await setMarketConfigurationById(bs, market.marketId(), {
      oracleNodeId: collateral.oracleNodeId(),
    });
    market.oracleNodeId = collateral.oracleNodeId;
    // Also make sure price align on the aggregator
    const collateralPrice = await collateral.getPrice();

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

    const fromDigestBefore = await PerpMarketProxy.getAccountDigest(fromTrader.accountId, marketId);
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
      desiredHooks: [MergeAccountSettlementHookMock.address],
    });

    const { receipt: fromOrderReceipt } = await commitAndSettle(
      bs,
      marketId,
      fromTrader,
      fromOrder
    );

    const fromOrderEvent = findEventSafe(fromOrderReceipt, 'OrderSettled', PerpMarketProxy);

    const fromDigestAfter = await PerpMarketProxy.getAccountDigest(fromTrader.accountId, marketId);
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
