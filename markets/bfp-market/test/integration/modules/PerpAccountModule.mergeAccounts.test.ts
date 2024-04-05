import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genOneOf,
  genOrder,
  genSide,
  genTrader,
  toRoundRobinGenerators,
} from '../../generators';
import {
  commitAndSettle,
  commitOrder,
  depositMargin,
  findEventSafe,
  getFastForwardTimestamp,
  getPythPriceDataByMarketId,
  setMarketConfigurationById,
  withExplicitEvmMine,
  withdrawAllCollateral,
} from '../../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import {
  address as trustedMulticallerAddress,
  abi as trustedMulticallerAbi,
  Multicall3 as TrustedMulticallForwarder,
} from '../../external/TrustedMulticallForwarder';
import { shuffle } from 'lodash';

describe('PerpAccountModule mergeAccounts', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, systems, provider, restore, collateralsWithoutSusd, keeper } = bs;

  beforeEach(restore);
  const createAccountsToMerge = async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();

    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };
    await BfpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);

    // Set the fromAccount to be the "vaultAccountId" that will have the new account merged into it.
    await MergeAccountSettlementHookMock.mockSetVaultAccountId(toTraderAccountId);

    // Ensure settlement hook has permission to merge both accounts. In a realistic scenario,
    // the settlement hook would own both of these account.
    await BfpMarketProxy.connect(fromTrader.signer).grantPermission(
      toTraderAccountId,
      ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL'),
      MergeAccountSettlementHookMock.address
    );
    await BfpMarketProxy.connect(fromTrader.signer).grantPermission(
      fromTrader.accountId,
      ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL'),
      MergeAccountSettlementHookMock.address
    );
    return { fromTrader, toTrader };
  };

  it('should revert when either account does not exist/has missing permission', async () => {
    const { BfpMarketProxy } = systems();

    const invalidAccountId = 42069;
    const validAccountId = genOneOf(traders()).accountId;

    await assertRevert(
      BfpMarketProxy.mergeAccounts(invalidAccountId, validAccountId, 1),
      `PermissionDenied`,
      BfpMarketProxy
    );
    await assertRevert(
      BfpMarketProxy.mergeAccounts(validAccountId, invalidAccountId, 1),
      `PermissionDenied`,
      BfpMarketProxy
    );
  });

  it('should revert if toId and fromId is the same', async () => {
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

  it('should revert when market does not exist', async () => {
    const { BfpMarketProxy } = systems();

    // Create two trader objects with different accountIds but same signer.
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    await BfpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);
    const invalidMarketId = 69420;
    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        toTraderAccountId,
        invalidMarketId
      ),
      `MarketNotFound("${invalidMarketId}")`,
      BfpMarketProxy
    );
  });

  it('should revert when positions are on the opposite side', async () => {
    const { BfpMarketProxy } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    const market = genOneOf(markets());

    const { marketId, collateralDepositAmount, collateral } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
      })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitAndSettle(bs, marketId, fromTrader, order);
    const { collateralDepositAmount: toTraderCollateralDepositAmount, collateral: toCollateral } =
      await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: toTrader,
          desiredMarket: market,
        })
      );
    const toOrder = await genOrder(bs, market, toCollateral, toTraderCollateralDepositAmount, {
      desiredSize: order.sizeDelta.mul(-1),
    });
    await commitAndSettle(bs, marketId, toTrader, toOrder);

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        toTrader.accountId,
        marketId
      ),
      `PositionsOppositeSide()`,
      BfpMarketProxy
    );
  });

  it('should revert when fromAccount is flagged', async () => {
    const { BfpMarketProxy } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    const market = genOneOf(markets());

    const { marketId, collateralDepositAmount, collateral } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
      })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 9,
    });
    await commitAndSettle(bs, marketId, fromTrader, order);

    await market.aggregator().mockSetCurrentPrice(
      wei(order.oraclePrice)
        .mul(order.sizeDelta.gt(0) ? 0.5 : 1.5)
        .toBN()
    );
    await withExplicitEvmMine(
      () => BfpMarketProxy.connect(keeper()).flagPosition(fromTrader.accountId, marketId),
      provider()
    );
    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        toTrader.accountId,
        marketId
      ),
      `PositionFlagged()`,
      BfpMarketProxy
    );
  });

  it('should revert when toAccount is flagged', async () => {
    const { BfpMarketProxy } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    const market = genOneOf(markets());
    const side = genSide();
    const {
      marketId,
      collateralDepositAmount: fromCollateralDepositAmount,
      collateral,
    } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
      })
    );
    await commitAndSettle(
      bs,
      marketId,
      fromTrader,
      genOrder(bs, market, collateral, fromCollateralDepositAmount, {
        desiredLeverage: 1,
        desiredSide: side,
      })
    );

    // Create flagable position for the toAccount
    const { collateralDepositAmount: toCollateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: toTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
      })
    );
    const toOrder = await genOrder(bs, market, collateral, toCollateralDepositAmount, {
      desiredLeverage: 9,
      desiredSide: side,
    });
    await commitAndSettle(bs, marketId, toTrader, toOrder);

    await market.aggregator().mockSetCurrentPrice(
      wei(toOrder.oraclePrice)
        .mul(toOrder.sizeDelta.gt(0) ? 0.5 : 1.5)
        .toBN()
    );
    await withExplicitEvmMine(
      () => BfpMarketProxy.connect(keeper()).flagPosition(toTrader.accountId, marketId),
      provider()
    );
    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        toTrader.accountId,
        marketId
      ),
      `PositionFlagged()`,
      BfpMarketProxy
    );
  });

  it('should revert when fromAccount.position.entryTime is not block.timestamp', async () => {
    const { BfpMarketProxy } = systems();
    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;

    const market = genOneOf(markets());

    const { marketId, collateralDepositAmount, collateral } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
      })
    );
    await BfpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId);

    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitAndSettle(bs, marketId, fromTrader, order);

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        toTraderAccountId,
        marketId
      ),
      `PositionTooOld()`,
      BfpMarketProxy
    );
  });

  it('should revert if called from a non settlement hook', async () => {
    const { BfpMarketProxy } = systems();

    const { fromTrader, toTrader } = await createAccountsToMerge();
    const market = genOneOf(markets());

    const { marketId, collateralDepositAmount, collateral } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
      })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 1,
    });
    await commitOrder(bs, marketId, fromTrader, order);

    const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, fromTrader);
    await fastForwardTo(settlementTime, provider());
    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    // Populate a multicall where we settle our own order and try to call mergeAccounts.
    const calls = [
      {
        target: BfpMarketProxy.address,
        callData: BfpMarketProxy.interface.encodeFunctionData('settleOrder', [
          fromTrader.accountId,
          marketId,
          updateData,
        ]),
        value: updateFee,
        allowFailure: false,
        requireSuccess: true,
      },
      {
        target: BfpMarketProxy.address,
        callData: BfpMarketProxy.interface.encodeFunctionData('mergeAccounts', [
          fromTrader.accountId,
          toTrader.accountId,
          market.marketId(),
        ]),
        value: bn(0),
        allowFailure: false,
        requireSuccess: true,
      },
    ];

    const trustedMultiCallForwarder = new ethers.Contract(
      trustedMulticallerAddress,
      trustedMulticallerAbi
    ) as TrustedMulticallForwarder;

    // The trustedMulticaller is not a whitelisted settlement hook. Assert revert.
    await assertRevert(
      trustedMultiCallForwarder.connect(fromTrader.signer).aggregate3(calls, { value: updateFee }),
      `InvalidHook("${trustedMulticallerAddress}")`,
      BfpMarketProxy
    );
  });

  it('should revert when toAccount has an open order', async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    const market = genOneOf(markets());

    // Deposit and commit an order for the toAccount which wont be settled.
    const { marketId, collateralDepositAmount, collateral } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: toTrader,
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
      BfpMarketProxy.connect(keeper()).settleOrder(fromTrader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `OrderFound()`,
      BfpMarketProxy
    );
  });

  it('should revert when fromAccount has an open order', async () => {
    const { BfpMarketProxy } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    const market = genOneOf(markets());

    // Deposit and commit an order for the toAccount which wont be settled.
    const { marketId, collateralDepositAmount, collateral } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
      })
    );
    await commitOrder(
      bs,
      marketId,
      fromTrader,
      genOrder(bs, market, collateral, collateralDepositAmount)
    );

    await assertRevert(
      BfpMarketProxy.connect(fromTrader.signer).mergeAccounts(
        fromTrader.accountId,
        toTrader.accountId,
        marketId
      ),
      `OrderFound()`,
      BfpMarketProxy
    );
  });

  it('should revert if toAccount position can be liquidated', async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();

    const market = genOneOf(markets());
    const side = genSide();

    // Deposit and create a highly leveraged position
    const { marketId, collateralDepositAmount, collateral } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: toTrader,
        desiredMarket: market,
      })
    );
    const toOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 9,
      desiredSide: side,
    });
    await commitAndSettle(bs, marketId, toTrader, toOrder);

    // Change price to make the toAccount liquidatable.
    const newPrice = wei(toOrder.oraclePrice)
      .mul(toOrder.sizeDelta.gt(0) ? 0.8 : 1.2)
      .toBN();
    await market.aggregator().mockSetCurrentPrice(newPrice);

    // Deposit margin and commit and settle with settlement hook for the fromAccount.
    await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
      })
    );
    const fromOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredSide: side,
      desiredHooks: [MergeAccountSettlementHookMock.address],
    });

    await commitOrder(bs, marketId, fromTrader, fromOrder);

    const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, fromTrader);
    await fastForwardTo(settlementTime, provider());

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    await assertRevert(
      BfpMarketProxy.connect(keeper()).settleOrder(fromTrader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `CanLiquidatePosition()`,
      BfpMarketProxy
    );
  });

  it('should revert when the merged position is below initial margin requirement', async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    const market = genOneOf(markets());

    // Withdraw any existing collateral.
    await withdrawAllCollateral(bs, fromTrader, market.marketId());
    await withdrawAllCollateral(bs, toTrader, market.marketId());

    // Set market price to 1, to make make it easier to create our expected scenario.
    const marketPrice = bn(1);
    await market.aggregator().mockSetCurrentPrice(marketPrice);

    // Deposit and create a highly leveraged position
    const { marketId, collateralDepositAmount, collateral } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: toTrader,
        desiredMarket: market,
        desiredMarginUsdDepositAmount: 500,
      })
    );

    const toOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredSize: bn(4000),
    });

    await commitAndSettle(bs, marketId, toTrader, toOrder);

    // Deposit margin and commit and settle with settlement hook for the fromAccount.
    await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
        desiredMarginUsdDepositAmount: 500,
      })
    );
    const fromOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredSize: bn(500),
      desiredHooks: [MergeAccountSettlementHookMock.address],
    });

    await commitOrder(bs, marketId, fromTrader, fromOrder);

    const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, fromTrader);
    await fastForwardTo(settlementTime, provider());

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    // Increase minMarginUsd to make IM checks fail and to avoid CanLiquidate revert.
    await setMarketConfigurationById(bs, market.marketId(), {
      minMarginUsd: bn(700),
    });

    await assertRevert(
      BfpMarketProxy.connect(keeper()).settleOrder(fromTrader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `InsufficientMargin()`,
      BfpMarketProxy
    );
  });

  it('should merge two accounts', async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();
    // Use nonUSD collateral to make sure we still have some debt. And use a generator to make sure we have two different collaterals for the fromAccount.
    const collateralGenerator = toRoundRobinGenerators(shuffle(collateralsWithoutSusd()));
    const market = genOneOf(markets());
    const side = genSide();

    // Withdraw any existing collateral.
    await withdrawAllCollateral(bs, fromTrader, market.marketId());
    const {
      collateral,
      collateralDepositAmount: collateralDepositAmountTo,
      marketId,
    } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: toTrader,
        // Use any collateral except sUSD for toAccount.
        desiredCollateral: genOneOf(collateralsWithoutSusd()),
        desiredMarket: market,
      })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmountTo, {
      desiredSide: side,
    });
    await commitAndSettle(bs, marketId, toTrader, order);

    // Create some debt for the toAccount, so we later can assert it's realized on account merge.
    await market.aggregator().mockSetCurrentPrice(
      wei(order.oraclePrice)
        .mul(order.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN()
    );

    const toOrder = await genOrder(bs, market, collateral, collateralDepositAmountTo, {
      desiredSize: wei(order.sizeDelta).mul(0.9).toBN(), // decrease position slightly
    });
    await commitAndSettle(bs, marketId, toTrader, toOrder);

    // Reset the price causing the toAccount's position to have some pnl.
    await market.aggregator().mockSetCurrentPrice(order.oraclePrice);

    // Start creating from position.
    const { collateralDepositAmount: collateralDepositAmountFrom } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
        desiredCollateral: collateralGenerator.next().value,
      })
    );
    // Make sure we have two different collaterals.
    await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
        desiredCollateral: collateralGenerator.next().value,
      })
    );

    const fromDigestBefore = await BfpMarketProxy.getAccountDigest(fromTrader.accountId, marketId);
    const toDigestBefore = await BfpMarketProxy.getAccountDigest(toTrader.accountId, marketId);
    const marketDigestBefore = await BfpMarketProxy.getMarketDigest(marketId);

    // Assert that the accounts have some collateral.
    assertBn.gt(fromDigestBefore.collateralUsd, 0);
    assertBn.gt(toDigestBefore.collateralUsd, 0);

    // Assert that from account has at least two collaterals
    const numberOfCollateralsWithBalance = fromDigestBefore.depositedCollaterals.filter((x) =>
      x.available.gt(0)
    ).length;

    assertBn.gt(bn(numberOfCollateralsWithBalance), 1);
    // The toAccount should also have some debt and an open position.
    assertBn.gt(toDigestBefore.debtUsd, 0);
    assertBn.notEqual(toDigestBefore.position.size, 0);

    // Create an order with the MergeAccountSettlementHookMock as a hook.
    const fromOrder = await genOrder(bs, market, collateral, collateralDepositAmountFrom, {
      desiredLeverage: 1,
      desiredHooks: [MergeAccountSettlementHookMock.address],
      desiredSide: side,
    });

    const { receipt: fromOrderReceipt } = await commitAndSettle(
      bs,
      marketId,
      fromTrader,
      fromOrder
    );

    const fromOrderEvent = findEventSafe(fromOrderReceipt, 'OrderSettled', BfpMarketProxy);

    const fromDigestAfter = await BfpMarketProxy.getAccountDigest(fromTrader.accountId, marketId);
    const toDigestAfter = await BfpMarketProxy.getAccountDigest(toTrader.accountId, marketId);
    const marketDigestAfter = await BfpMarketProxy.getMarketDigest(marketId);

    assertBn.isZero(fromDigestAfter.collateralUsd);
    assertBn.isZero(fromDigestAfter.position.size);
    assertBn.isZero(fromDigestAfter.debtUsd);

    // Before the fromPosition gets merged into the toPosition, we should be realizing the to position.
    const profitsFromRealizingToPosition = toDigestBefore.position.pnl
      .add(toDigestBefore.position.accruedFunding)
      .sub(toDigestBefore.position.accruedUtilization);

    const expectedDebt = Wei.max(
      wei(0),
      wei(toDigestBefore.debtUsd).sub(profitsFromRealizingToPosition)
    )
      .toBN()
      .add(fromOrderEvent.args.accountDebt); // Debt from order fees.
    const expectedUsdCollateral = Wei.max(
      wei(0),
      wei(profitsFromRealizingToPosition).sub(toDigestBefore.debtUsd)
    ).toBN();

    // Assert global tracking (totalTraderDebtUsd and totalCollateralValueUsd)
    assertBn.near(
      marketDigestBefore.totalTraderDebtUsd.sub(toDigestBefore.debtUsd).add(expectedDebt),
      marketDigestAfter.totalTraderDebtUsd,
      bn(0.0001)
    );
    assertBn.near(
      marketDigestBefore.totalCollateralValueUsd.add(expectedUsdCollateral),
      marketDigestAfter.totalCollateralValueUsd,
      bn(0.001)
    );

    // Assert the toAccount got realized correctly.
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

    // Assert event.
    await assertEvent(
      fromOrderReceipt,
      `AccountsMerged(${fromTrader.accountId}, ${toTrader.accountId}, ${marketId})`,
      BfpMarketProxy
    );
  });
});
