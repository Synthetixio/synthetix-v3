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
import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

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
    const { PerpMarketProxy } = systems();
    await assertEvent(
      await PerpMarketProxy.suspendAllFeatures(),
      `PerpMarketSuspended(true)`,
      PerpMarketProxy
    );
    await assertRevert(
      PerpMarketProxy['createAccount()'](),
      `FeatureUnavailable("${formatBytes32String('createAccount')}")`,
      PerpMarketProxy
    );
    await assertEvent(
      await PerpMarketProxy.enableAllFeatures(),
      `PerpMarketSuspended(false)`,
      PerpMarketProxy
    );
    const tx = await PerpMarketProxy['createAccount()']();
    assert.ok(tx);
  });

  it('should disable create account', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('createAccount');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);
    await assertRevert(
      PerpMarketProxy['createAccount()'](),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable deposit', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('deposit');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

    const trader = genOneOf(traders());
    const market = genOneOf(markets());
    const collateral = genOneOf(collaterals());
    const amountDelta = bn(genNumber(50, 1000));

    await mintAndApprove(bs, collateral, amountDelta, trader.signer);

    await assertRevert(
      PerpMarketProxy.connect(trader.signer).modifyCollateral(
        trader.accountId,
        market.marketId(),
        collateral.synthMarketId(),
        amountDelta
      ),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable withdraw', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('withdraw');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

    const { trader, market, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );

    await assertRevert(
      PerpMarketProxy.connect(trader.signer).modifyCollateral(
        trader.accountId,
        market.marketId(),
        collateral.synthMarketId(),
        collateralDepositAmount.mul(-1)
      ),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
    await assertRevert(
      PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
        trader.accountId,
        market.marketId()
      ),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable commitOrder', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('commitOrder');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await assertRevert(
      PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        [ADDRESS0]
      ),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable settleOrder', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('settleOrder');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitOrder(bs, marketId, trader, order);
    const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);
    await assertRevert(
      PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable cancelOrder', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('cancelOrder');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
      bs,
      genTrader(bs)
    );
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitOrder(bs, marketId, trader, order);
    const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    await assertRevert(
      PerpMarketProxy.connect(trader.signer).cancelOrder(trader.accountId, marketId, updateData, {
        value: updateFee,
      }),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
    await assertRevert(
      PerpMarketProxy.connect(trader.signer).cancelStaleOrder(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable payDebt', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('payDebt');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

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
      PerpMarketProxy.payDebt(trader.accountId, marketId, bn(1)),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable liquidateMarginOnly', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('liquidateMarginOnly');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

    const { trader, marketId } = await depositMargin(bs, genTrader(bs));

    await assertRevert(
      PerpMarketProxy.liquidateMarginOnly(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable mergeAccounts', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('mergeAccount');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

    await assertRevert(
      PerpMarketProxy.mergeAccounts(1, 2, 3),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable splitAccount', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('mergeAccount');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

    await assertRevert(
      PerpMarketProxy.splitAccount(1, 2, 3, bn(0.1)),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable flagPosition', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('flagPosition');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

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
      PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });

  it('should disable liquidatePosition', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('liquidatePosition');
    const { receipt } = await withExplicitEvmMine(
      () => PerpMarketProxy.setFeatureFlagDenyAll(feature, true),
      provider()
    );
    await assertEvent(receipt, `FeatureFlagDenyAllSet("${feature}", true)`, PerpMarketProxy);

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
    await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
    await assertRevert(
      PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`,
      PerpMarketProxy
    );
  });
});
