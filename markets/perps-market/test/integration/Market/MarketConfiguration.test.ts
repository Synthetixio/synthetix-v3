import { bn } from '@synthetixio/main/test/common';
import { bootstrapMarkets } from '../bootstrap';
import { Signer, ethers, utils } from 'ethers';
import assertRevert from '@synthetixio/core-utils/src/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/src/utils/assertions/assert-event';
import assert from 'assert';

describe('MarketConfiguration', async () => {
  const { systems, signers, owner } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [],
    traderAccountIds: [],
  });
  let randomUser: Signer;

  const marketId = 25;
  const fixture = {
    token: 'snxETH',
    marketName: 'TestPerpsMarket',
    orderFees: { makerFee: 0, takerFee: 1 },
    settlementStrategy: {
      strategyType: 0,
      settlementDelay: 500,
      settlementWindowDuration: 100,
      priceWindowDuration: 90,
      priceVerificationContract: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      feedId: utils.formatBytes32String('feedId'),
      url: 'url',
      settlementReward: 100,
      disabled: true,
    },

    maxMarketValue: bn(10_000),
    maxFundingVelocity: bn(0.3),
    skewScale: bn(1),
    initialMarginFraction: bn(2),
    minimumInitialMarginRatio: bn(0.01),
    maintenanceMarginScalar: bn(0.5),
    lockedOiPercentRatioD18: bn(15),
    maxLiquidationLimitAccumulationMultiplier: bn(5),
    minimumPositionMargin: bn(50),
    liquidationRewardRatioD18: bn(10e9),
    maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
    maxLiquidationPd: bn(0),
  };

  before('identify actors', async () => {
    const [, , randomAccount] = signers();
    randomUser = randomAccount;
  });

  before('create perps market', async () => {
    await systems().PerpsMarket.createMarket(marketId, fixture.marketName, fixture.token);
  });

  it('owner can set settlement strategy and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .addSettlementStrategy(marketId, fixture.settlementStrategy),
      'SettlementStrategyAdded(' +
        marketId.toString() +
        ', [' +
        fixture.settlementStrategy.strategyType.toString() +
        ', ' +
        fixture.settlementStrategy.settlementDelay.toString() +
        ', ' +
        fixture.settlementStrategy.settlementWindowDuration.toString() +
        ', ' +
        fixture.settlementStrategy.priceWindowDuration.toString() +
        ', "' +
        fixture.settlementStrategy.priceVerificationContract.toString() +
        '", "' +
        fixture.settlementStrategy.feedId.toString() +
        '", "' +
        fixture.settlementStrategy.url.toString() +
        '", ' +
        fixture.settlementStrategy.settlementReward.toString() +
        ', ' +
        fixture.settlementStrategy.disabled.toString() +
        '], 0)',
      systems().PerpsMarket
    );
  });
  it('owner can enable settlement strategy and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setSettlementStrategyEnabled(marketId, 0, fixture.settlementStrategy.disabled),
      'SettlementStrategyEnabled(' +
        marketId.toString() +
        ', ' +
        0 +
        ', ' +
        String(fixture.settlementStrategy.disabled) +
        ')',
      systems().PerpsMarket
    );
  });

  it('owner can set order fees and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setOrderFees(marketId, fixture.orderFees.makerFee, fixture.orderFees.takerFee),
      'OrderFeesSet(' +
        marketId.toString() +
        ', ' +
        fixture.orderFees.makerFee.toString() +
        ', ' +
        fixture.orderFees.takerFee.toString() +
        ')',
      systems().PerpsMarket
    );
  });
  it('owner can set max market value and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setMaxMarketSize(marketId, fixture.maxMarketValue),
      'MaxMarketSizeSet(' + marketId.toString() + ', ' + fixture.maxMarketValue.toString() + ')',
      systems().PerpsMarket
    );
  });

  it('owner can set funding parameters and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setFundingParameters(marketId, fixture.skewScale, fixture.maxFundingVelocity),
      'FundingParametersSet(' +
        marketId.toString() +
        ', ' +
        fixture.skewScale.toString() +
        ', ' +
        fixture.maxFundingVelocity.toString() +
        ')',
      systems().PerpsMarket
    );
  });

  it('owner can set liquidation parameters and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setLiquidationParameters(
          marketId,
          fixture.initialMarginFraction,
          fixture.minimumInitialMarginRatio,
          fixture.maintenanceMarginScalar,
          fixture.liquidationRewardRatioD18,
          fixture.minimumPositionMargin
        ),
      `LiquidationParametersSet(${marketId.toString()}, ${fixture.initialMarginFraction.toString()}, ${fixture.maintenanceMarginScalar.toString()}, ${fixture.minimumInitialMarginRatio.toString()}, ${fixture.liquidationRewardRatioD18.toString()}, ${fixture.minimumPositionMargin.toString()})`,
      systems().PerpsMarket
    );
  });

  it('owner can set max liquidation parameters and events are emitted', async () => {
    const randomUserAddress = await randomUser.getAddress();
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setMaxLiquidationParameters(
          marketId,
          fixture.maxLiquidationLimitAccumulationMultiplier,
          fixture.maxSecondsInLiquidationWindow,
          fixture.maxLiquidationPd,
          randomUserAddress
        ),
      `MaxLiquidationParametersSet(${marketId.toString()}, ${fixture.maxLiquidationLimitAccumulationMultiplier.toString()}, ${fixture.maxSecondsInLiquidationWindow.toString()}, ${fixture.maxLiquidationPd.toString()}, "${randomUserAddress}")`,
      systems().PerpsMarket
    );
  });

  it('owner can set all locked OI percentage and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setLockedOiRatio(marketId, fixture.lockedOiPercentRatioD18),
      'LockedOiRatioSet(' +
        marketId.toString() +
        ', ' +
        fixture.lockedOiPercentRatioD18.toString() +
        ')',
      systems().PerpsMarket
    );
  });

  it('should revert transaction when not market owner sets parameters', async () => {
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .addSettlementStrategy(marketId, fixture.settlementStrategy),
      'Unauthorized'
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setSettlementStrategyEnabled(marketId, 0, true),
      'Unauthorized'
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setOrderFees(marketId, fixture.orderFees.makerFee, fixture.orderFees.takerFee),
      'Unauthorized'
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setMaxMarketSize(marketId, fixture.maxMarketValue),
      'Unauthorized'
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setFundingParameters(marketId, fixture.skewScale, fixture.maxFundingVelocity),
      'Unauthorized'
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setLiquidationParameters(
          marketId,
          fixture.initialMarginFraction,
          fixture.minimumInitialMarginRatio,
          fixture.maintenanceMarginScalar,
          fixture.liquidationRewardRatioD18,
          fixture.minimumPositionMargin
        ),
      'Unauthorized'
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setMaxLiquidationParameters(
          marketId,
          fixture.maxLiquidationLimitAccumulationMultiplier,
          fixture.maxSecondsInLiquidationWindow,
          fixture.maxLiquidationPd,
          ethers.constants.AddressZero
        ),
      'Unauthorized'
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setLockedOiRatio(marketId, fixture.lockedOiPercentRatioD18),
      'Unauthorized'
    );
  });

  it('get maxMarketValue', async () => {
    const maxMarketValue = await systems().PerpsMarket.getMaxMarketSize(marketId);
    assertBn.equal(maxMarketValue, fixture.maxMarketValue);
  });

  it('get settlementStrategy', async () => {
    const settlementStrategy = await systems().PerpsMarket.getSettlementStrategy(marketId, 0);
    assertBn.equal(settlementStrategy.settlementDelay, fixture.settlementStrategy.settlementDelay);
    assertBn.equal(
      settlementStrategy.settlementWindowDuration,
      fixture.settlementStrategy.settlementWindowDuration
    );
    assertBn.equal(
      settlementStrategy.settlementReward,
      fixture.settlementStrategy.settlementReward
    );
    assert.equal(settlementStrategy.disabled, !fixture.settlementStrategy.disabled);
    assert.equal(settlementStrategy.url, fixture.settlementStrategy.url);
    assert.equal(settlementStrategy.feedId, fixture.settlementStrategy.feedId);
    assert.equal(
      settlementStrategy.priceVerificationContract,
      fixture.settlementStrategy.priceVerificationContract
    );
  });

  it('get orderFees', async () => {
    const [makerFee, takerFee] = await systems().PerpsMarket.getOrderFees(marketId);
    assertBn.equal(makerFee, fixture.orderFees.makerFee);
    assertBn.equal(takerFee, fixture.orderFees.takerFee);
  });

  it('get fundingParameters', async () => {
    const [skewScale, maxFundingVelocity] =
      await systems().PerpsMarket.getFundingParameters(marketId);
    assertBn.equal(maxFundingVelocity, fixture.maxFundingVelocity);
    assertBn.equal(skewScale, fixture.skewScale);
  });

  it('get liquidationParameters', async () => {
    const [
      initialMarginFraction,
      minimumInitialMarginRatio,
      maintenanceMarginScalar,
      liquidationRewardRatioD18,
    ] = await systems().PerpsMarket.getLiquidationParameters(marketId);
    assertBn.equal(initialMarginFraction, fixture.initialMarginFraction);
    assertBn.equal(minimumInitialMarginRatio, fixture.minimumInitialMarginRatio);
    assertBn.equal(maintenanceMarginScalar, fixture.maintenanceMarginScalar);
    assertBn.equal(liquidationRewardRatioD18, fixture.liquidationRewardRatioD18);
  });

  it('get maxLiquidationParameters', async () => {
    const [
      maxLiquidationLimitAccumulationMultiplier,
      maxSecondsInLiquidationWindow,
      maxLiquidationPd,
      endorsedLiquidator,
    ] = await systems().PerpsMarket.getMaxLiquidationParameters(marketId);
    assertBn.equal(maxLiquidationPd, fixture.maxLiquidationPd);
    assert.equal(endorsedLiquidator, await randomUser.getAddress());
    assertBn.equal(
      maxLiquidationLimitAccumulationMultiplier,
      fixture.maxLiquidationLimitAccumulationMultiplier
    );
    assertBn.equal(maxSecondsInLiquidationWindow, fixture.maxSecondsInLiquidationWindow);
  });
});
