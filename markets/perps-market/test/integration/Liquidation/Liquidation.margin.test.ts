import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, openPosition } from '../helpers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers } from 'ethers';
import assert from 'assert/strict';

describe('Liquidation - margin', () => {
  const perpsMarketConfigs = [
    {
      requestedMarketId: 50,
      name: 'Bitcoin',
      token: 'BTC',
      price: bn(30_000),
      fundingParams: { skewScale: bn(100), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.01),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 51,
      name: 'Ether',
      token: 'ETH',
      price: bn(2000),
      fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.01),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 52,
      name: 'Link',
      token: 'LINK',
      price: bn(5),
      fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.01),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 53,
      name: 'Arbitrum',
      token: 'ARB',
      price: bn(2),
      fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(1.5),
        minimumInitialMarginRatio: bn(0.035),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 54,
      name: 'Optimism',
      token: 'OP',
      price: bn(2),
      fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(1.5),
        minimumInitialMarginRatio: bn(0.035),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
  ];

  const { systems, provider, trader1, perpsMarkets, owner, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: perpsMarketConfigs,
    traderAccountIds: [2, 3],
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(20_000));
  });

  let commonOpenPositionProps: Pick<
    OpenPositionData,
    'systems' | 'provider' | 'trader' | 'accountId' | 'keeper'
  >;
  before('identify common props', async () => {
    commonOpenPositionProps = {
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: trader1(),
    };
  });

  before('open positions', async () => {
    const positionSizes = [
      bn(-1), // btc short
      bn(20), // eth long
      bn(2000), // link long
      bn(5000), // arb long
      bn(5000), // op long
    ];

    for (const [i, perpsMarket] of perpsMarkets().entries()) {
      await openPosition({
        ...commonOpenPositionProps,
        marketId: perpsMarket.marketId(),
        sizeDelta: positionSizes[i],
        settlementStrategyId: perpsMarket.strategyId(),
        price: perpsMarketConfigs[i].price,
      });
    }
  });

  describe('account check after initial positions open', () => {
    it('should', async () => {
      assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), bn(100_000));

      let pnl, size;

      // btc 0
      [pnl, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[0].marketId());
      assertBn.equal(size, bn(-1));
      assertBn.equal(pnl, bn(-150));

      // eth 1
      [pnl, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[1].marketId());
      assertBn.equal(size, bn(20));
      assertBn.equal(pnl, bn(-400));

      // link 2
      [pnl, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[2].marketId());
      assertBn.equal(size, bn(2000));
      assertBn.equal(pnl, bn(-100));

      // arb 3
      [pnl, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[3].marketId());
      assertBn.equal(size, bn(5000));
      assertBn.equal(pnl, bn(-250));

      // op 4
      [pnl, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[4].marketId());
      assertBn.equal(size, bn(5000));
      assertBn.equal(pnl, bn(-250));

      // has correct available margin
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(18_850));

      // is not eligible for liquidation
      await assertRevert(
        systems().PerpsMarket.connect(keeper()).liquidate(2),
        'NotEligibleForLiquidation'
      );
    });
  });

  describe('prices changes', () => {
    it('should have the correct position pnl', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(28000)); // btc
      await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(1900)); // eth
      await perpsMarkets()[2].aggregator().mockSetCurrentPrice(bn(4.6)); // link
      await perpsMarkets()[3].aggregator().mockSetCurrentPrice(bn(1.9)); // arb
      await perpsMarkets()[4].aggregator().mockSetCurrentPrice(bn(1.8)); // op

      let pnl;

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[0].marketId());
      assertBn.equal(pnl, bn(1850)); // btc

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[1].marketId());
      assertBn.equal(pnl, bn(-2400)); // eth

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[2].marketId());
      assertBn.equal(pnl, bn(-900)); // link

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[3].marketId());
      assertBn.equal(pnl, bn(-750)); // arb

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[4].marketId());
      assertBn.equal(pnl, bn(-1250)); // op

      // has correct available margin
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(16_550));

      // is not eligible for liquidation
      await assertRevert(
        systems().PerpsMarket.connect(keeper()).liquidate(2),
        'NotEligibleForLiquidation'
      );
      assert.equal(await systems().PerpsMarket.canLiquidate(2), false);
    });
  });

  describe('price change - available margin 0 ', () => {
    it('should have correct position pnl', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(31000)); // btc
      await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(1775)); // eth
      await perpsMarkets()[2].aggregator().mockSetCurrentPrice(bn(3)); // link
      await perpsMarkets()[3].aggregator().mockSetCurrentPrice(bn(1)); // arb
      await perpsMarkets()[4].aggregator().mockSetCurrentPrice(bn(1.13)); // op

      let pnl;

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[0].marketId());
      assertBn.equal(pnl, bn(-1150)); // btc

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[1].marketId());
      assertBn.equal(pnl, bn(-4900)); // eth

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[2].marketId());
      assertBn.equal(pnl, bn(-4100)); // link

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[3].marketId());
      assertBn.equal(pnl, bn(-5250)); // arb

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[4].marketId());
      assertBn.equal(pnl, bn(-4600)); // op

      // has correct available margin
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(0));
    });
  });

  describe('minimumPositionMargin increased -> eligible for liquidation', () => {
    const restoreMinimumPositionMargin = snapshotCheckpoint(provider);
    before('set minimumPositionMargin for OP to 50', async () => {
      const opMarketId = perpsMarkets()[4].marketId();
      const initialMarginFraction = bn(1.5);
      const maintenanceMarginScalar = bn(0.035);
      const minimumInitialMarginRatio = bn(0.5);
      const maxLiquidationLimitAccumulationMultiplier = bn(1);
      const liquidationRewardRatio = bn(0.05);
      const maxSecondsInLiquidationWindow = ethers.BigNumber.from(10);
      const minimumPositionMargin = bn(50); // this is the only change from the initial values
      await systems()
        .PerpsMarket.connect(owner())
        .setLiquidationParameters(
          opMarketId,
          initialMarginFraction,
          maintenanceMarginScalar,
          minimumInitialMarginRatio,
          liquidationRewardRatio,
          minimumPositionMargin
        );
      await systems()
        .PerpsMarket.connect(owner())
        .setMaxLiquidationParameters(
          opMarketId,
          maxLiquidationLimitAccumulationMultiplier,
          maxSecondsInLiquidationWindow,
          0,
          ethers.constants.AddressZero
        );
    });
    // Changing minimumPositionMargin does not have an affect on available margin
    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(0));
    });

    // It does have an affect on liquidations, so withdrawals should be blocked
    it('reverts when trying to withdraw', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(-100)),
        'AccountLiquidatable(2)'
      );
    });

    // sanity check
    it('is eligible for liquidation', async () => {
      assert.equal(await systems().PerpsMarket.canLiquidate(2), true);
    });
    // reset minimumPositionMargin to 0
    after(restoreMinimumPositionMargin);
  });

  describe('price change - eligible for liquidation', () => {
    it('should have correct position pnl', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(31000)); // btc
      await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(1820)); // eth
      await perpsMarkets()[2].aggregator().mockSetCurrentPrice(bn(3)); // link
      await perpsMarkets()[3].aggregator().mockSetCurrentPrice(bn(1)); // arb
      await perpsMarkets()[4].aggregator().mockSetCurrentPrice(bn(1)); // op, the only one that has a price change

      let pnl;

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[0].marketId());
      assertBn.equal(bn(-1150), pnl); // btc

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[1].marketId());
      assertBn.equal(bn(-4000), pnl); // eth

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[2].marketId());
      assertBn.equal(bn(-4100), pnl); // link

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[3].marketId());
      assertBn.equal(bn(-5250), pnl); // arb

      [pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarkets()[4].marketId());
      assertBn.equal(bn(-5250), pnl); // op
    });

    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(250));
    });

    it('reverts when trying to withdraw', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(-100)),
        'AccountLiquidatable'
      );
    });

    it('does not allow you to open a position', async () => {
      await assertRevert(
        openPosition({
          ...commonOpenPositionProps,
          marketId: perpsMarkets()[0].marketId(),
          sizeDelta: bn(-1),
          settlementStrategyId: perpsMarkets()[0].strategyId(),
          price: perpsMarketConfigs[0].price,
        }),
        'AccountLiquidatable'
      );
    });
  });
});
