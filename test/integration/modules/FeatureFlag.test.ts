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
} from '../../helpers';

import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import { assertEvents } from '../../assert';

describe('FeatureFlag', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collaterals, traders, systems, restore, keeper } = bs;

  beforeEach(restore);
  it('should suspend/enable all features', async () => {
    const { PerpMarketProxy } = systems();
    await assertEvents(
      await PerpMarketProxy.suspendAllFeatures(),
      [
        `FeatureFlagDenyAllSet("${formatBytes32String('createAccount')}", true)`,
        `FeatureFlagDenyAllSet("${formatBytes32String('deposit')}", true)`,
        `FeatureFlagDenyAllSet("${formatBytes32String('withdraw')}", true)`,
        `FeatureFlagDenyAllSet("${formatBytes32String('commitOrder')}", true)`,
        `FeatureFlagDenyAllSet("${formatBytes32String('settleOrder')}", true)`,
        `FeatureFlagDenyAllSet("${formatBytes32String('cancelOrder')}", true)`,
        `FeatureFlagDenyAllSet("${formatBytes32String('flagPosition')}", true)`,
        `FeatureFlagDenyAllSet("${formatBytes32String('liquidatePosition')}", true)`,
      ],
      PerpMarketProxy
    );

    await assertEvents(
      await PerpMarketProxy.enableAllFeatures(),
      [
        `FeatureFlagAllowAllSet("${formatBytes32String('createAccount')}", true)`,
        `FeatureFlagAllowAllSet("${formatBytes32String('deposit')}", true)`,
        `FeatureFlagAllowAllSet("${formatBytes32String('withdraw')}", true)`,
        `FeatureFlagAllowAllSet("${formatBytes32String('commitOrder')}", true)`,
        `FeatureFlagAllowAllSet("${formatBytes32String('settleOrder')}", true)`,
        `FeatureFlagAllowAllSet("${formatBytes32String('cancelOrder')}", true)`,
        `FeatureFlagAllowAllSet("${formatBytes32String('flagPosition')}", true)`,
        `FeatureFlagAllowAllSet("${formatBytes32String('liquidatePosition')}", true)`,
      ],
      PerpMarketProxy
    );
  });
  it('should disable create account', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('createAccount');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);
    // TODO, when this reverts it said the revert was coming from the spotMarket.synthetix.createAccount 🤔
    await assertRevert(PerpMarketProxy['createAccount()'](), `FeatureUnavailable("${feature}")`);
  });
  it('should disable deposit', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('deposit');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);

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
      `FeatureUnavailable("${feature}")`
    );
  });
  it('should disable withdraw', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('withdraw');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);

    const { trader, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));

    await assertRevert(
      PerpMarketProxy.connect(trader.signer).modifyCollateral(
        trader.accountId,
        market.marketId(),
        collateral.synthMarketId(),
        collateralDepositAmount.mul(-1)
      ),
      `FeatureUnavailable("${feature}")`
    );
    await assertRevert(
      PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, market.marketId()),
      `FeatureUnavailable("${feature}")`
    );
  });
  it('should disable commitOrder', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('commitOrder');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await assertRevert(
      PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd
      ),
      `FeatureUnavailable("${feature}")`
    );
  });
  it('should disable settleOrder', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('settleOrder');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitOrder(bs, marketId, trader, order);
    const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);
    await assertRevert(
      PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, { value: updateFee }),
      `FeatureUnavailable("${feature}")`
    );
  });
  it('should disable cancelOrder', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('cancelOrder');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitOrder(bs, marketId, trader, order);
    const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

    await assertRevert(
      PerpMarketProxy.connect(trader.signer).cancelOrder(trader.accountId, marketId, updateData, { value: updateFee }),
      `FeatureUnavailable("${feature}")`
    );
    await assertRevert(
      PerpMarketProxy.connect(trader.signer).cancelStaleOrder(trader.accountId, marketId),
      `FeatureUnavailable("${feature}")`
    );
  });
  it('should disable settleOrder', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('settleOrder');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
    const order = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitOrder(bs, marketId, trader, order);
    const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

    const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);
    await assertRevert(
      PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, { value: updateFee }),
      `FeatureUnavailable("${feature}")`
    );
  });
  it('should disable flagPosition', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('flagPosition');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
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
      `FeatureUnavailable("${feature}")`
    );
  });
  it('should disable liquidatePosition', async () => {
    const { PerpMarketProxy } = systems();
    const feature = formatBytes32String('liquidatePosition');
    await PerpMarketProxy.setFeatureFlagDenyAll(feature, true);

    const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
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
      `FeatureUnavailable("${feature}")`
    );
  });
});
