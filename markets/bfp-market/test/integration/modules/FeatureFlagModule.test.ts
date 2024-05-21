import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import assert from 'assert';
import { formatBytes32String } from 'ethers/lib/utils';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import {
  mintAndApprove,
  depositMargin,
  commitAndSettle,
  commitOrder,
  getPythPriceDataByMarketId,
  getFastForwardTimestamp,
  ADDRESS0,
  withExplicitEvmMine,
} from '../../helpers';

describe('FeatureFlagModule', () => {
  const bs = bootstrap(genBootstrap());
  const {
    markets,
    collaterals,
    traders,
    systems,
    restore,
    keeper,
    provider,
    collateralsWithoutSusd,
  } = bs;

  beforeEach(restore);

  it('should suspend and enable all features', async () => {
    const { BfpMarketProxy } = systems();
    await assertEvent(
      await BfpMarketProxy.suspendAllFeatures(),
      `PerpMarketSuspended(true)`,
      BfpMarketProxy
    );
    await assertRevert(
      BfpMarketProxy['createAccount()'](),
      `FeatureUnavailable("${formatBytes32String('createAccount')}")`,
      BfpMarketProxy
    );
    await assertEvent(
      await BfpMarketProxy.enableAllFeatures(),
      `PerpMarketSuspended(false)`,
      BfpMarketProxy
    );
    const tx = await BfpMarketProxy['createAccount()']();
    assert.ok(tx);
  });

  it('should disable create account', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('createAccount');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);
    await assertRevert(
      BfpMarketProxy['createAccount()'](),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable deposit', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('deposit');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const trader = genOneOf(traders());
    const market = genOneOf(markets());
    const collateral = genOneOf(collaterals());
    const amountDelta = bn(genNumber(50, 1000));

    await mintAndApprove(bs, collateral, amountDelta, trader.signer);

    await assertRevert(
      BfpMarketProxy.connect(trader.signer).modifyCollateral(
        trader.accountId,
        market.marketId(),
        collateral.address(),
        amountDelta
      ),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable withdraw', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('withdraw');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const { trader, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );

    await assertRevert(
      BfpMarketProxy.connect(trader.signer).modifyCollateral(
        trader.accountId,
        market.marketId(),
        collateral.address(),
        collateralDepositAmount.mul(-1)
      ),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
    await assertRevert(
      BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(
        trader.accountId,
        market.marketId()
      ),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable commitOrder', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('commitOrder');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await assertRevert(
      BfpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        [ADDRESS0]
      ),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable settleOrder', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('settleOrder');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitOrder(bs, marketId, trader, order);
    const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);
    await assertRevert(
      BfpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable cancelOrder', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('cancelOrder');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitOrder(bs, marketId, trader, order);
    const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    await assertRevert(
      BfpMarketProxy.connect(trader.signer).cancelOrder(trader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
    await assertRevert(
      BfpMarketProxy.connect(trader.signer).cancelStaleOrder(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable payDebt', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('payDebt');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitAndSettle(bs, marketId, trader, order);
    const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredSize: order.sizeDelta.mul(-1),
    });
    await commitAndSettle(bs, marketId, trader, closeOrder);
    await assertRevert(
      BfpMarketProxy.payDebt(trader.accountId, marketId, bn(1)),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable liquidateMarginOnly', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('liquidateMarginOnly');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const { trader, marketId } = await depositMargin(bs, genTrader(bs));

    await assertRevert(
      BfpMarketProxy.liquidateMarginOnly(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable mergeAccounts', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('mergeAccount');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    await assertRevert(
      BfpMarketProxy.mergeAccounts(1, 2, 3),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable splitAccount', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('splitAccount');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    await assertRevert(
      BfpMarketProxy.splitAccount(1, 2, 3, bn(0.1)),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable flagPosition', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('flagPosition');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 10,
    });

    await commitAndSettle(bs, marketId, trader, order);

    // Price falls/rises between 10% should results in a healthFactor of < 1.
    //
    // Whether it goes up or down depends on the side of the order.
    const newMarketOraclePrice = wei(order.oraclePrice)
      .mul(order.sizeDelta.gt(0) ? 0.9 : 1.1)
      .toBN();
    await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

    await assertRevert(
      BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });

  it('should disable liquidatePosition', async () => {
    const { BfpMarketProxy } = systems();
    const feature = formatBytes32String('liquidatePosition');
    const { receipt } = await withExplicitEvmMine(
      () => BfpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, BfpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
      desiredLeverage: 10,
    });

    await commitAndSettle(bs, marketId, trader, order);

    // Price falls/rises between 10% should results in a healthFactor of < 1.
    //
    // Whether it goes up or down depends on the side of the order.
    const newMarketOraclePrice = wei(order.oraclePrice)
      .mul(order.sizeDelta.gt(0) ? 0.9 : 1.1)
      .toBN();
    await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
    await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
    await assertRevert(
      BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`,
      BfpMarketProxy
    );
  });
});
