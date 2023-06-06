import { bn } from '@synthetixio/main/test/common';
import { bootstrapMarkets } from '../bootstrap';
import { BigNumber, Signer, utils } from 'ethers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/src/utils/assertions/assert-revert';

describe('MarketConfiguration', async () => {
  const fixture = {
    token: 'snxETH',
    marketName: 'TestPerpsMarket',
    orderFees: { makerFee: 0, takerFee: 1 },
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
    const [, owner, randomAccount] = signers();
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
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setOrderFees(marketId, fixture.orderFees.makerFee, fixture.orderFees.takerFee);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaxMarketValue(marketId, fixture.maxMarketValue);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setFundingParameters(marketId, fixture.skewScale, fixture.maxFundingVelocity);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setLiquidationParameters(
        marketId,
        fixture.initialMarginFraction,
        fixture.maintenanceMarginFraction,
        fixture.liquidationRewardRatioD18,
        fixture.maxLiquidationLimitAccumulationMultiplier
      );
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setLockedOiPercent(marketId, fixture.lockedOiPercent);
  });

  it('should revert transaction when not market owner sets parameters', async () => {
    const owner = await marketOwner.getAddress();
    const randomUserAddress = await randomUser.getAddress();

    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .addSettlementStrategy(marketId, fixture.settlementStrategy),
      `OnlyMarketOwner("${owner}", "${randomUserAddress}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setOrderFees(marketId, fixture.orderFees.makerFee, fixture.orderFees.takerFee),
      `OnlyMarketOwner("${owner}", "${randomUserAddress}")`
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setMaxMarketValue(marketId, fixture.maxMarketValue),
      `OnlyMarketOwner("${owner}", "${randomUserAddress}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setFundingParameters(marketId, fixture.skewScale, fixture.maxFundingVelocity),
      `OnlyMarketOwner("${owner}", "${randomUserAddress}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setLiquidationParameters(
          marketId,
          fixture.initialMarginFraction,
          fixture.maintenanceMarginFraction,
          fixture.liquidationRewardRatioD18,
          fixture.maxLiquidationLimitAccumulationMultiplier
        ),
      `OnlyMarketOwner("${owner}", "${randomUserAddress}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setLockedOiPercent(marketId, fixture.lockedOiPercent),
      `OnlyMarketOwner("${owner}", "${randomUserAddress}")`
    );
  });

  // TODO: split into separate it blocks and use the new getters
  // it('get all market properties', async () => {
  //   const orderFees = await systems().PerpsMarket.getOrderFees(marketId, 0);
  //   assertBn.equal(orderFees.makerFee, fixture.orderFees.takerFee.makerFee);
  //   assertBn.equal(orderFees.takerFee, fixture.orderFees.takerFee.takerFee);
  //   const settlementStrategies = await systems().PerpsMarket.getSettlementStrategies(marketId);
  //   assertBn.equal(settlementStrategies[0].strategyType, fixture.settlementStrategy.strategyType);
  //   assertBn.equal(
  //     settlementStrategies[0].settlementDelay,
  //     fixture.settlementStrategy.settlementDelay
  //   );
  //   assertBn.equal(
  //     settlementStrategies[0].settlementWindowDuration,
  //     fixture.settlementStrategy.settlementWindowDuration
  //   );
  //   assertBn.equal(
  //     settlementStrategies[0].settlementReward,
  //     fixture.settlementStrategy.settlementReward
  //   );
  //   assertBn.equal(
  //     settlementStrategies[0].priceDeviationTolerance,
  //     fixture.settlementStrategy.priceDeviationTolerance
  //   );
  //   assert.equal(settlementStrategies[0].disabled, fixture.settlementStrategy.disabled);
  //   assert.equal(settlementStrategies[0].url, fixture.settlementStrategy.url);
  //   assert.equal(settlementStrategies[0].feedId, fixture.settlementStrategy.feedId);
  //   assert.equal(
  //     settlementStrategies[0].priceVerificationContract,
  //     fixture.settlementStrategy.priceVerificationContract
  //   );

  //   const maxMarketValue = await systems().PerpsMarket.getMaxMarketValue(marketId);
  //   assertBn.equal(maxMarketValue, fixture.maxMarketValue);
  //   const maxFundingVelocity = await systems().PerpsMarket.getMaxFundingVelocity(marketId);
  //   assertBn.equal(maxFundingVelocity, fixture.maxFundingVelocity);
  //   const skewScale = await systems().PerpsMarket.getSkewScale(marketId);
  //   assertBn.equal(skewScale, fixture.skewScale);
  //   const initialMarginFraction = await systems().PerpsMarket.getInitialMarginFraction(marketId);
  //   assertBn.equal(initialMarginFraction, fixture.initialMarginFraction);
  //   const maintenanceMarginFraction = await systems().PerpsMarket.getMaintenanceMarginFraction(
  //     marketId
  //   );
  //   assertBn.equal(maintenanceMarginFraction, fixture.maintenanceMarginFraction);
  //   const lockedOiPercent = await systems().PerpsMarket.getLockedOiPercent(marketId);
  //   assertBn.equal(lockedOiPercent, fixture.lockedOiPercent);
  //   const maxLiquidationLimitAccumulationMultiplier =
  //     await systems().PerpsMarket.getMaxLiquidationLimitAccumulationMultiplier(marketId);
  //   assertBn.equal(
  //     maxLiquidationLimitAccumulationMultiplier,
  //     fixture.maxLiquidationLimitAccumulationMultiplier
  //   );
  //   const liquidationRewardRatioD18 = await systems().PerpsMarket.getLiquidationRewardRatioD18(
  //     marketId
  //   );
  //   assertBn.equal(liquidationRewardRatioD18, fixture.liquidationRewardRatioD18);
  // });
});
