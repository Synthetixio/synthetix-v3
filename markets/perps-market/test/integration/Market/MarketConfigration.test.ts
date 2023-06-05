import { bn } from '@synthetixio/main/test/common';
import { bootstrapMarkets } from '../bootstrap';
import { BigNumber, Signer, utils } from 'ethers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/src/utils/assertions/assert-revert';
import assert from 'assert';

describe('MarketConfiguration', async () => {
  const fixture = {
    token: 'snxETH',
    marketName: 'TestPerpsMarket',
    oderFees: { makerFee: 0, takerFee: 1 },
    settlementStrategy: {
      strategyType: 0,
      settlementDelay: 500,
      settlementWindowDuration: 100,
      priceVerificationContract: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      feedId: utils.formatBytes32String('feedId'),
      url: 'url',
      settlementReward: 100,
      priceDeviationTolerance: 200,
      disabled: false,
    },

    maxMarketValue: bn(10_000),
    maxFundingVelocity: bn(0.3),
    skewScale: bn(1),
    initialMarginFraction: bn(2),
    maintenanceMarginFraction: bn(10),
    lockedOiPercent: bn(15),
    maxLiquidationLimitAccumulationMultiplier: bn(5),
    liquidationRewardRatioD18: bn(10e9),
  };

  const { systems, signers } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [],
    traderAccountIds: [],
  });

  let marketId: BigNumber;
  let randomUser: Signer;
  let marketOwner: Signer;

  before('identify actors', async () => {
    const [, owner, randomAccount] = await signers();
    randomUser = randomAccount;
    marketOwner = owner;
  });

  before('create perps market', async () => {
    marketId = await systems().PerpsMarket.callStatic.createMarket(
      fixture.marketName,
      fixture.token,
      marketOwner.getAddress()
    );
    await systems().PerpsMarket.createMarket(
      fixture.marketName,
      fixture.token,
      await marketOwner.getAddress()
    );
  });

  it('owner can set all market configurations properties', async () => {
    await systems()
      .PerpsMarket.connect(marketOwner)
      .addSettlementStrategy(marketId, fixture.settlementStrategy);
    await systems().PerpsMarket.connect(marketOwner).setSkewScale(marketId, fixture.skewScale);
    await systems().PerpsMarket.connect(marketOwner).setOrderFees(marketId, 0, fixture.oderFees);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaxMarketValue(marketId, fixture.maxMarketValue);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaxFundingVelocity(marketId, fixture.maxFundingVelocity);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setInitialMarginFraction(marketId, fixture.initialMarginFraction);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaintenanceMarginFraction(marketId, fixture.maintenanceMarginFraction);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setLockedOiPercent(marketId, fixture.lockedOiPercent);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaxLiquidationLimitAccumulationMultiplier(
        marketId,
        fixture.maxLiquidationLimitAccumulationMultiplier
      );
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setLiquidationRewardRatioD18(marketId, fixture.liquidationRewardRatioD18);
  });

  it('should revert transaction when not market owner sets parameters', async () => {
    const owner = await marketOwner.getAddress();

    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .addSettlementStrategy(marketId, fixture.settlementStrategy),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setSkewScale(marketId, fixture.skewScale),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setOrderFees(marketId, 0, fixture.oderFees),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setMaxMarketValue(marketId, fixture.maxMarketValue),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setMaxFundingVelocity(marketId, fixture.maxFundingVelocity),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setInitialMarginFraction(marketId, fixture.initialMarginFraction),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setMaintenanceMarginFraction(marketId, fixture.maintenanceMarginFraction),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setLockedOiPercent(marketId, fixture.lockedOiPercent),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setMaxLiquidationLimitAccumulationMultiplier(
          marketId,
          fixture.maxLiquidationLimitAccumulationMultiplier
        ),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setLiquidationRewardRatioD18(marketId, fixture.liquidationRewardRatioD18),
      `OnlyMarketOwner("${owner}", "${await randomUser.getAddress()}")`
    );
  });

  it('get all market properties', async () => {
    const orderFees = await systems().PerpsMarket.getOrderFees(marketId, 0);
    assertBn.equal(orderFees.makerFee, fixture.oderFees.makerFee);
    assertBn.equal(orderFees.takerFee, fixture.oderFees.takerFee);
    const settlementStrategies = await systems().PerpsMarket.getSettlementStrategies(marketId);
    assertBn.equal(settlementStrategies[0].strategyType, fixture.settlementStrategy.strategyType);
    assertBn.equal(
      settlementStrategies[0].settlementDelay,
      fixture.settlementStrategy.settlementDelay
    );
    assertBn.equal(
      settlementStrategies[0].settlementWindowDuration,
      fixture.settlementStrategy.settlementWindowDuration
    );
    assertBn.equal(
      settlementStrategies[0].settlementReward,
      fixture.settlementStrategy.settlementReward
    );
    assertBn.equal(
      settlementStrategies[0].priceDeviationTolerance,
      fixture.settlementStrategy.priceDeviationTolerance
    );
    assert.equal(settlementStrategies[0].disabled, fixture.settlementStrategy.disabled);
    assert.equal(settlementStrategies[0].url, fixture.settlementStrategy.url);
    assert.equal(settlementStrategies[0].feedId, fixture.settlementStrategy.feedId);
    assert.equal(
      settlementStrategies[0].priceVerificationContract,
      fixture.settlementStrategy.priceVerificationContract
    );

    const maxMarketValue = await systems().PerpsMarket.getMaxMarketValue(marketId);
    assertBn.equal(maxMarketValue, fixture.maxMarketValue);
    const maxFundingVelocity = await systems().PerpsMarket.getMaxFundingVelocity(marketId);
    assertBn.equal(maxFundingVelocity, fixture.maxFundingVelocity);
    const skewScale = await systems().PerpsMarket.getSkewScale(marketId);
    assertBn.equal(skewScale, fixture.skewScale);
    const initialMarginFraction = await systems().PerpsMarket.getInitialMarginFraction(marketId);
    assertBn.equal(initialMarginFraction, fixture.initialMarginFraction);
    const maintenanceMarginFraction = await systems().PerpsMarket.getMaintenanceMarginFraction(
      marketId
    );
    assertBn.equal(maintenanceMarginFraction, fixture.maintenanceMarginFraction);
    const lockedOiPercent = await systems().PerpsMarket.getLockedOiPercent(marketId);
    assertBn.equal(lockedOiPercent, fixture.lockedOiPercent);
    const maxLiquidationLimitAccumulationMultiplier =
      await systems().PerpsMarket.getMaxLiquidationLimitAccumulationMultiplier(marketId);
    assertBn.equal(
      maxLiquidationLimitAccumulationMultiplier,
      fixture.maxLiquidationLimitAccumulationMultiplier
    );
    const liquidationRewardRatioD18 = await systems().PerpsMarket.getLiquidationRewardRatioD18(
      marketId
    );
    assertBn.equal(liquidationRewardRatioD18, fixture.liquidationRewardRatioD18);
  });
});
