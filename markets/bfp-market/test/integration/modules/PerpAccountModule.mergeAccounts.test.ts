import { BigNumber, ethers } from 'ethers';
import { shuffle } from 'lodash';
import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import Wei, { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genNumber,
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
  getSusdCollateral,
  setMarketConfigurationById,
  withExplicitEvmMine,
  withdrawAllCollateral,
} from '../../helpers';
import { calcDebtCorrection, calcPricePnl } from '../../calculations';

describe('PerpAccountModule mergeAccounts', () => {
  const bs = bootstrap(genBootstrap());
  const {
    markets,
    traders,
    systems,
    provider,
    restore,
    collateralsWithoutSusd,
    collaterals,
    keeper,
  } = bs;

  beforeEach(restore);

  const createAccountsToMerge = async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();

    const fromTrader = genOneOf(traders());
    const toTraderAccountId = 42069;
    const toTrader = {
      signer: fromTrader.signer,
      accountId: toTraderAccountId,
    };

    await withExplicitEvmMine(
      () => BfpMarketProxy.connect(fromTrader.signer)['createAccount(uint128)'](toTraderAccountId),
      provider()
    );

    // Set the fromAccount to be the "vaultAccountId" that will have the new account merged into it.
    await withExplicitEvmMine(
      () => MergeAccountSettlementHookMock.mockSetVaultAccountId(toTraderAccountId),
      provider()
    );

    // Ensure settlement hook has permission to merge both accounts. In a realistic scenario,
    // the settlement hook would own both of these account.
    await withExplicitEvmMine(
      () =>
        BfpMarketProxy.connect(fromTrader.signer).grantPermission(
          toTraderAccountId,
          ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL'),
          MergeAccountSettlementHookMock.address
        ),
      provider()
    );

    await withExplicitEvmMine(
      () =>
        BfpMarketProxy.connect(fromTrader.signer).grantPermission(
          fromTrader.accountId,
          ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL'),
          MergeAccountSettlementHookMock.address
        ),
      provider()
    );

    return { fromTrader, toTrader };
  };

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

  it('should revert when toId account does not exist', async () => {
    const { BfpMarketProxy } = systems();

    const marketId = genOneOf(markets()).marketId();
    const trader = genOneOf(traders());

    const fromId = trader.accountId;
    const toId = 69696969;

    await assertRevert(
      BfpMarketProxy.connect(trader.signer).mergeAccounts(fromId, toId, marketId),
      `AccountNotFound("${toId}")`,
      BfpMarketProxy
    );
  });

  it('should revert when fromId account does not exist', async () => {
    const { BfpMarketProxy } = systems();

    const marketId = genOneOf(markets()).marketId();
    const trader = genOneOf(traders());

    const fromId = 69696969;
    const toId = trader.accountId;

    await assertRevert(
      BfpMarketProxy.connect(trader.signer).mergeAccounts(fromId, toId, marketId),
      `AccountNotFound("${fromId}")`,
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
      `InvalidPositionSide()`,
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
    const marketId = market.marketId();
    const side = genSide();

    const { collateralDepositAmount: fromCollateralDepositAmount, collateral } =
      await depositMargin(
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

    // Create flagable position for the toAccount.
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

  it('should revert when calling mergeAccount from non settlement hook', async () => {
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
      `InvalidHook("${await fromTrader.signer.getAddress()}")`,
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
        desiredMarginUsdDepositAmount: 2000,
      })
    );

    const toOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 8,
    });

    await commitAndSettle(bs, marketId, toTrader, toOrder);

    // Deposit margin and commit and settle with settlement hook for the fromAccount.
    await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredCollateral: collateral,
        desiredMarket: market,
        desiredMarginUsdDepositAmount: 2000,
      })
    );
    const fromOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredSize: bn(2000),
      desiredHooks: [MergeAccountSettlementHookMock.address],
    });

    await commitOrder(bs, marketId, fromTrader, fromOrder);

    const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, fromTrader);
    await fastForwardTo(settlementTime, provider());

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    // Increase minMarginUsd to make IM checks fail and to avoid CanLiquidate revert.
    await setMarketConfigurationById(bs, market.marketId(), {
      minMarginUsd: bn(2800),
    });

    await assertRevert(
      BfpMarketProxy.connect(keeper()).settleOrder(fromTrader.accountId, marketId, updateData, {
        value: updateFee,
        maxFeePerGas: BigNumber.from(500 * 1e9), // Specify a large maxFeePerGas so callers can set a high basefee without any problems.
        gasLimit: BigNumber.from(10_000_000), // Sometimes gas estimation is not high enough.
      }),
      `InsufficientMargin()`,
      BfpMarketProxy
    );
  });

  it('should merge two accounts with sUSD collateral', async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();

    const side = genSide();
    const market = genOneOf(markets());
    const { answer: marketPrice } = await market.aggregator().latestRoundData();

    const {
      collateral,
      collateralDepositAmount: collateralDepositAmountTo,
      marketId,
    } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: toTrader,
        desiredCollateral: getSusdCollateral(collaterals()),
        desiredMarket: market,
      })
    );

    // Open position for toAccount.
    const order = await genOrder(bs, market, collateral, collateralDepositAmountTo, {
      desiredSide: side,
      desiredLeverage: genNumber(1, 3),
    });
    await commitAndSettle(bs, marketId, toTrader, order);

    // Start creating from position.
    const { collateralDepositAmount: collateralDepositAmountFrom } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
        desiredMarket: market,
        desiredCollateral: getSusdCollateral(collaterals()),
      })
    );
    const fromDigestBefore = await BfpMarketProxy.getAccountDigest(fromTrader.accountId, marketId);
    const toDigestBefore = await BfpMarketProxy.getAccountDigest(toTrader.accountId, marketId);

    // Assert that the accounts have some collateral.
    assertBn.gt(fromDigestBefore.collateralUsd, 0);
    assertBn.gt(toDigestBefore.collateralUsd, 0);

    // The toAccount should also have some debt and an open position.
    assertBn.notEqual(toDigestBefore.position.size, 0);

    // Not that the we have debt eventhough we use sUSD collateral, as postions only get realised from settlement when
    assertBn.gt(toDigestBefore.debtUsd, 0);

    // Create an order with the MergeAccountSettlementHookMock as a hook.
    const fromOrder = await genOrder(bs, market, collateral, collateralDepositAmountFrom, {
      desiredHooks: [MergeAccountSettlementHookMock.address],
      desiredSide: side,
      desiredLeverage: genNumber(1, 3),
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

    // Before the fromPosition gets merged into the toPosition, we should be realizing the to position.
    const pnlFromRealizingToPosition = toDigestBefore.position.pnl
      .add(toDigestBefore.position.accruedFunding)
      .sub(toDigestBefore.position.accruedUtilization)
      .sub(toDigestBefore.debtUsd);

    const fromPositionPricePnl = calcPricePnl(
      fromOrderEvent.args.sizeDelta,
      order.oraclePrice,
      fromOrderEvent.args.fillPrice
    );
    const pnlFromRealizingFromPosition = fromPositionPricePnl
      .add(fromOrderEvent.args.accruedFunding)
      .sub(fromOrderEvent.args.accruedUtilization)
      .sub(fromOrderEvent.args.accountDebt);
    const expectedUsdCollateralDiff = wei(pnlFromRealizingToPosition).add(
      pnlFromRealizingFromPosition
    );

    const expectedCollateralUsd = fromDigestBefore.collateralUsd
      .add(toDigestBefore.collateralUsd)
      .add(expectedUsdCollateralDiff.toBN());

    // Assert the merged position

    // Expect no debt as we use sUSD collateral.
    assertBn.isZero(toDigestAfter.debtUsd);
    assertBn.near(expectedCollateralUsd, toDigestAfter.collateralUsd, bn(0.0001));
    assertBn.equal(
      fromOrderEvent.args.sizeDelta.add(toDigestBefore.position.size),
      toDigestAfter.position.size
    );

    // Ensure the merged position has the correct Pyth price at settlement.
    assertBn.equal(toDigestAfter.position.entryPrice, marketPrice);
    assertBn.equal(toDigestAfter.position.entryPythPrice, marketPrice);

    // Assert from position empty
    assertBn.isZero(fromDigestAfter.collateralUsd);
    assertBn.isZero(fromDigestAfter.position.size);
    assertBn.isZero(fromDigestAfter.debtUsd);

    // Assert event.
    await assertEvent(
      fromOrderReceipt,
      `AccountsMerged(${fromTrader.accountId}, ${toTrader.accountId}, ${marketId})`,
      BfpMarketProxy
    );
  });

  it('should update debt correction when merging', async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader } = await createAccountsToMerge();

    const { collateral, market, collateralDepositAmount, marketId } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredTrader: fromTrader,
      })
    );
    const marketDigest1 = await BfpMarketProxy.getMarketDigest(marketId);

    assertBn.isZero(marketDigest1.debtCorrection);

    const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredHooks: [MergeAccountSettlementHookMock.address],
    });
    const { receipt } = await commitAndSettle(bs, marketId, fromTrader, order);
    const orderSettleEvent = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy);

    const marketDigest2 = await BfpMarketProxy.getMarketDigest(marketId);

    // Calculate expected debtCorrection.
    // `debtCorrection` = `prevDebtCorrection` + `fundingDelta` + `notionalDelta` + `totalPositionPnl`
    // First calculate `debtCorrection` for the first order
    const prevDebtCorrection = wei(0);
    const sizeDelta = orderSettleEvent.args.sizeDelta;
    const fundingDelta = wei(0);
    const notionalDelta = wei(orderSettleEvent.args.fillPrice).mul(sizeDelta);
    const totalPositionPnl = wei(0);
    const expectedDebtCorrectionBeforeMerge = calcDebtCorrection(
      prevDebtCorrection,
      fundingDelta,
      notionalDelta,
      totalPositionPnl
    );

    // Calculate `debtCorrection` from realizing `from` position.
    const sizeDelta2 = wei(0).sub(orderSettleEvent.args.sizeDelta);
    const fundingDelta2 = wei(0);
    const notionalDelta2 = wei(order.oraclePrice).mul(sizeDelta2);
    const totalPositionPnl2 = calcPricePnl(order.sizeDelta, order.oraclePrice, order.fillPrice);
    const expectedDebtCorrectionAfterFrom = calcDebtCorrection(
      expectedDebtCorrectionBeforeMerge,
      fundingDelta2,
      notionalDelta2,
      wei(totalPositionPnl2)
    );

    // Calculate `debtCorrection` from realizing `to` position.
    const sizeDelta3 = orderSettleEvent.args.sizeDelta;
    const fundingDelta3 = wei(0);
    const notionalDelta3 = wei(order.oraclePrice).mul(sizeDelta3);
    const totalPositionPnl3 = wei(0);
    const expectedDebtCorrection = calcDebtCorrection(
      expectedDebtCorrectionAfterFrom,
      fundingDelta3,
      notionalDelta3,
      totalPositionPnl3
    );

    assertBn.equal(marketDigest2.debtCorrection, expectedDebtCorrection.toBN());
  });

  it('should merge two accounts', async () => {
    const { BfpMarketProxy, MergeAccountSettlementHookMock } = systems();
    const { fromTrader, toTrader } = await createAccountsToMerge();

    // Use nonUSD collateral to make sure we still have some debt and use a generator to make sure we have two different
    // collaterals for the fromAccount.
    const collateralGenerator = toRoundRobinGenerators(shuffle(collateralsWithoutSusd()));
    const market = genOneOf(markets());
    const side = genSide();

    // Withdraw any existing collateral.
    await withdrawAllCollateral(bs, fromTrader, market.marketId());
    await withdrawAllCollateral(bs, toTrader, market.marketId());

    // Deposit some margin for toAccount.
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
    // Open position for toAccount.
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

    // Decrease position slightly, to realize the debt.
    const toOrder = await genOrder(bs, market, collateral, collateralDepositAmountTo, {
      desiredSize: wei(order.sizeDelta).mul(0.9).toBN(),
    });
    await commitAndSettle(bs, marketId, toTrader, toOrder);

    // Reset the price causing the toAccount's position to have some positive pnl.
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

    // Assert that the accounts have some collateral.
    assertBn.gt(fromDigestBefore.collateralUsd, 0);
    assertBn.gt(toDigestBefore.collateralUsd, 0);

    // Assert that from account has two collaterals
    const numberOfCollateralsWithBalance = fromDigestBefore.depositedCollaterals.filter((x) =>
      x.available.gt(0)
    ).length;

    assert.equal(numberOfCollateralsWithBalance, 2);
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
    const pnlFromRealizingToPosition = toDigestBefore.position.pnl
      .add(toDigestBefore.position.accruedFunding)
      .sub(toDigestBefore.position.accruedUtilization);

    const fromPositionPricePnl = calcPricePnl(
      fromOrderEvent.args.sizeDelta,
      order.oraclePrice,
      fromOrderEvent.args.fillPrice
    );
    const pnlFromRealizingFromPosition = fromPositionPricePnl
      .add(fromOrderEvent.args.accruedFunding)
      .sub(fromOrderEvent.args.accruedUtilization);

    const expectedDebtToPosition = Wei.max(
      wei(0),
      wei(toDigestBefore.debtUsd).sub(pnlFromRealizingToPosition)
    );

    const expectedDebtFromPosition = Wei.max(
      wei(0),
      wei(fromOrderEvent.args.accountDebt).sub(pnlFromRealizingFromPosition)
    );
    const expectedTotalDebt = expectedDebtToPosition.add(expectedDebtFromPosition);

    // Calculate what the collateral for the from position would be before moving it to `toPosition`.
    // If profits are bigger than debt, we expect collateral increase. But losses wont will show up as debt as we're using non sUSD collateral.
    const realizedCollateralFrom = wei(fromDigestBefore.collateralUsd).add(
      Wei.max(wei(0), wei(pnlFromRealizingFromPosition).sub(fromOrderEvent.args.accountDebt))
    );
    const realizedCollateralTo = wei(toDigestBefore.collateralUsd).add(
      Wei.max(wei(0), wei(pnlFromRealizingToPosition).sub(toDigestBefore.debtUsd))
    );

    const expectedTotalCollateralValueUsd = realizedCollateralFrom.add(realizedCollateralTo);

    // Assert global tracking (totalTraderDebtUsd and totalCollateralValueUsd)
    assertBn.equal(expectedTotalDebt.toBN(), marketDigestAfter.totalTraderDebtUsd);
    assertBn.near(
      expectedTotalCollateralValueUsd.toBN(),
      marketDigestAfter.totalCollateralValueUsd,
      bn(0.001)
    );

    // Assert the toAccount got realized correctly.
    assertBn.equal(expectedTotalDebt.toBN(), toDigestAfter.debtUsd);
    assertBn.equal(fromDigestAfter.position.size, 0);

    assertBn.near(expectedTotalCollateralValueUsd.toBN(), toDigestAfter.collateralUsd, bn(0.001));
    assertBn.equal(
      fromOrderEvent.args.sizeDelta.add(toDigestBefore.position.size),
      toDigestAfter.position.size
    );

    // Ensure the merged position has the correct Pyth price at settlement.
    assertBn.equal(toDigestAfter.position.entryPrice, order.oraclePrice);
    assertBn.equal(toDigestAfter.position.entryPythPrice, order.oraclePrice);

    // Assert event.
    await assertEvent(
      fromOrderReceipt,
      `AccountsMerged(${fromTrader.accountId}, ${toTrader.accountId}, ${marketId})`,
      BfpMarketProxy
    );
  });
});
