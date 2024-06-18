import { bn } from '@synthetixio/main/test/common';
import { bootstrapMarkets } from '../bootstrap';
import { Signer, ethers, utils } from 'ethers';
import assertRevert from '@synthetixio/core-utils/src/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/src/utils/assertions/assert-event';
import assert from 'assert';

describe('MarketConfiguration', () => {
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
      commitmentPriceDelay: 0,
      settlementDelay: 500,
      settlementWindowDuration: 5000,
      priceVerificationContract: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      feedId: utils.formatBytes32String('feedId'),
      settlementReward: 100,
      disabled: true,
    },
    newSettlementStrategy: {
      strategyType: 0,
      commitmentPriceDelay: 10,
      settlementDelay: 1000,
      settlementWindowDuration: 10000,
      priceVerificationContract: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      feedId: utils.formatBytes32String('feedId'),
      settlementReward: 200,
      disabled: true,
    },
    maxMarketSize: bn(10_000),
    maxMarketValue: bn(10_000_000),
    maxFundingVelocity: bn(0.3),
    skewScale: bn(1),
    initialMarginFraction: bn(2),
    minimumInitialMarginRatio: bn(0.01),
    maintenanceMarginScalar: bn(0.5),
    lockedOiPercentRatioD18: bn(15),
    maxLiquidationLimitAccumulationMultiplier: bn(5),
    minimumPositionMargin: bn(50),
    flagRewardRatioD18: bn(10e9),
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

  describe('settlement strategy', () => {
    describe('adding strategy', () => {
      it('fails using non-owner', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(randomUser)
            .addSettlementStrategy(marketId, fixture.settlementStrategy),
          `Unauthorized`,
          systems().PerpsMarket
        );
      });

      it('emits event on success', async () => {
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
            ', "' +
            fixture.settlementStrategy.priceVerificationContract.toString() +
            '", "' +
            fixture.settlementStrategy.feedId.toString() +
            '", ' +
            fixture.settlementStrategy.settlementReward.toString() +
            ', ' +
            fixture.settlementStrategy.disabled.toString() +
            ', ' +
            fixture.settlementStrategy.commitmentPriceDelay.toString() +
            '], 0)',
          systems().PerpsMarket
        );
      });
    });

    describe('updating strategy', () => {
      describe('when not owner', () => {
        it('reverts', async () => {
          await assertRevert(
            systems()
              .PerpsMarket.connect(randomUser)
              .setSettlementStrategyEnabled(marketId, 0, true),
            `Unauthorized`,
            systems().PerpsMarket
          );

          await assertRevert(
            systems()
              .PerpsMarket.connect(randomUser)
              .setSettlementStrategy(marketId, 0, fixture.settlementStrategy),
            `Unauthorized`,
            systems().PerpsMarket
          );
        });
      });

      describe('when strategy doesnt exist', () => {
        it('reverts', async () => {
          await assertRevert(
            systems().PerpsMarket.connect(owner()).setSettlementStrategyEnabled(marketId, 1, true),
            `InvalidSettlementStrategy("1")`,
            systems().PerpsMarket
          );

          await assertRevert(
            systems()
              .PerpsMarket.connect(owner())
              .setSettlementStrategy(marketId, 1, fixture.settlementStrategy),
            `InvalidSettlementStrategy("1")`,
            systems().PerpsMarket
          );
        });
      });

      it('owner can enable settlement strategy and events are emitted', async () => {
        await assertEvent(
          await systems()
            .PerpsMarket.connect(owner())
            .setSettlementStrategyEnabled(marketId, 0, fixture.settlementStrategy.disabled),
          `SettlementStrategySet(${marketId}, 0`,
          systems().PerpsMarket
        );
      });

      it('owner can update settlement strategy and events are emitted', async () => {
        const txn = await systems()
          .PerpsMarket.connect(owner())
          .setSettlementStrategy(marketId, 0, fixture.newSettlementStrategy);

        await assertEvent(
          txn,
          'SettlementStrategySet(' +
            marketId.toString() +
            ', 0, [' +
            fixture.newSettlementStrategy.strategyType.toString() +
            ', ' +
            fixture.newSettlementStrategy.settlementDelay.toString() +
            ', ' +
            fixture.newSettlementStrategy.settlementWindowDuration.toString() +
            ', "' +
            fixture.newSettlementStrategy.priceVerificationContract.toString() +
            '", "' +
            fixture.newSettlementStrategy.feedId.toString() +
            '", ' +
            fixture.newSettlementStrategy.settlementReward.toString() +
            ', ' +
            fixture.newSettlementStrategy.disabled.toString() +
            ', ' +
            fixture.newSettlementStrategy.commitmentPriceDelay.toString() +
            '])',
          systems().PerpsMarket
        );
      });
    });

    describe('getter', () => {
      it('gets settlementStrategy', async () => {
        const settlementStrategy = await systems().PerpsMarket.getSettlementStrategy(marketId, 0);
        assertBn.equal(
          settlementStrategy.settlementDelay,
          fixture.newSettlementStrategy.settlementDelay
        );
        assertBn.equal(
          settlementStrategy.settlementWindowDuration,
          fixture.newSettlementStrategy.settlementWindowDuration
        );
        assertBn.equal(
          settlementStrategy.settlementReward,
          fixture.newSettlementStrategy.settlementReward
        );
        assert.equal(settlementStrategy.disabled, fixture.newSettlementStrategy.disabled);
        assert.equal(settlementStrategy.feedId, fixture.newSettlementStrategy.feedId);
        assert.equal(
          settlementStrategy.priceVerificationContract,
          fixture.newSettlementStrategy.priceVerificationContract
        );
      });
    });

    describe('delay', () => {
      it('if settlement strategy settlement delay is set to zero, defaults to 1', async () => {
        const settlementStrategy = {
          ...fixture.settlementStrategy,
          settlementDelay: 0,
        };
        await systems()
          .PerpsMarket.connect(owner())
          .addSettlementStrategy(marketId, settlementStrategy),
          'SettlementStrategyAdded(' +
            marketId.toString() +
            ', [' +
            settlementStrategy.strategyType.toString() +
            ', ' +
            settlementStrategy.settlementDelay.toString() +
            ', ' +
            bn(1).toString() +
            ', "' +
            settlementStrategy.priceVerificationContract.toString() +
            '", "' +
            settlementStrategy.feedId.toString() +
            '", ' +
            settlementStrategy.settlementReward.toString() +
            ', ' +
            settlementStrategy.disabled.toString() +
            '], 0)',
          systems().PerpsMarket;
      });
    });
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
  it('owner can set max market size and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setMaxMarketSize(marketId, fixture.maxMarketSize),
      'MaxMarketSizeSet(' + marketId.toString() + ', ' + fixture.maxMarketSize.toString() + ')',
      systems().PerpsMarket
    );
  });

  it('owner can set max market value and events are emitted', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .setMaxMarketValue(marketId, fixture.maxMarketValue),
      'MaxMarketValueSet(' + marketId.toString() + ', ' + fixture.maxMarketValue.toString() + ')',
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
          fixture.flagRewardRatioD18,
          fixture.minimumPositionMargin
        ),
      `LiquidationParametersSet(${marketId.toString()}, ${fixture.initialMarginFraction.toString()}, ${fixture.maintenanceMarginScalar.toString()}, ${fixture.minimumInitialMarginRatio.toString()}, ${fixture.flagRewardRatioD18.toString()}, ${fixture.minimumPositionMargin.toString()})`,
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

    const lockedOiRatio = await systems().PerpsMarket.getLockedOiRatio(marketId);
    assertBn.equal(lockedOiRatio, fixture.lockedOiPercentRatioD18);
  });

  it('should revert when a non-owner owner attempts to set parameters', async () => {
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .addSettlementStrategy(marketId, fixture.settlementStrategy),
      'Unauthorized',
      systems().PerpsMarket
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setSettlementStrategy(marketId, 0, fixture.settlementStrategy),
      'Unauthorized',
      systems().PerpsMarket
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setSettlementStrategyEnabled(marketId, 0, true),
      'Unauthorized',
      systems().PerpsMarket
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setOrderFees(marketId, fixture.orderFees.makerFee, fixture.orderFees.takerFee),
      'Unauthorized',
      systems().PerpsMarket
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setMaxMarketSize(marketId, fixture.maxMarketSize),
      'Unauthorized',
      systems().PerpsMarket
    );
    await assertRevert(
      systems().PerpsMarket.connect(randomUser).setMaxMarketValue(marketId, fixture.maxMarketValue),
      'Unauthorized',
      systems().PerpsMarket
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setFundingParameters(marketId, fixture.skewScale, fixture.maxFundingVelocity),
      'Unauthorized',
      systems().PerpsMarket
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setLiquidationParameters(
          marketId,
          fixture.initialMarginFraction,
          fixture.minimumInitialMarginRatio,
          fixture.maintenanceMarginScalar,
          fixture.flagRewardRatioD18,
          fixture.minimumPositionMargin
        ),
      'Unauthorized',
      systems().PerpsMarket
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
      'Unauthorized',
      systems().PerpsMarket
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(randomUser)
        .setLockedOiRatio(marketId, fixture.lockedOiPercentRatioD18),
      'Unauthorized',
      systems().PerpsMarket
    );
  });

  it('get maxMarketSize', async () => {
    const maxMarketSize = await systems().PerpsMarket.getMaxMarketSize(marketId);
    assertBn.equal(maxMarketSize, fixture.maxMarketSize);
  });

  it('get maxMarketValue', async () => {
    const maxMarketValue = await systems().PerpsMarket.getMaxMarketValue(marketId);
    assertBn.equal(maxMarketValue, fixture.maxMarketValue);
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
      flagRewardRatioD18,
    ] = await systems().PerpsMarket.getLiquidationParameters(marketId);
    assertBn.equal(initialMarginFraction, fixture.initialMarginFraction);
    assertBn.equal(minimumInitialMarginRatio, fixture.minimumInitialMarginRatio);
    assertBn.equal(maintenanceMarginScalar, fixture.maintenanceMarginScalar);
    assertBn.equal(flagRewardRatioD18, fixture.flagRewardRatioD18);
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
