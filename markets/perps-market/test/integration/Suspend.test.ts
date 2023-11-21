import { PerpsMarket, bn, bootstrapMarkets } from './bootstrap';
import { openPosition } from './helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { fastForwardTo, getTxTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';

describe('System suspend', async () => {
  const { systems, trader1, keeper, provider, perpsMarkets, owner } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 50,
        name: 'Optimism',
        token: 'OP',
        price: bn(10),
        orderFees: {
          makerFee: bn(0.007),
          takerFee: bn(0.003),
        },
        fundingParams: { skewScale: bn(1000000), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: bn(3),
          minimumInitialMarginRatio: bn(0),
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
    ],
    traderAccountIds: [2, 3],
  });

  let perpsMarket: PerpsMarket;
  before('identify actors', () => {
    perpsMarket = perpsMarkets()[0];
  });

  const feature = ethers.utils.formatBytes32String('perpsSystem');
  before('suspend system', async () => {
    await systems().PerpsMarket.connect(owner()).setFeatureFlagDenyAll(feature, true);
  });

  describe('fails on all actions', () => {
    it('fails on modify collateral', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(2, perpsMarket.marketId(), bn(10)),
        `FeatureUnavailable("${feature}")`
      );
    });

    it('fails on commit order', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: perpsMarket.marketId(),
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1050),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `FeatureUnavailable("${feature}")`
      );
    });

    let commitTime: number;
    describe('create position', () => {
      before('set allow all perps system', async () => {
        await systems().PerpsMarket.connect(owner()).setFeatureFlagAllowAll(feature, true);
      });

      it('created order', async () => {
        // add collateral
        await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(1200));
        const commitTxn = await systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: perpsMarket.marketId(),
            accountId: 2,
            sizeDelta: bn(5_000),
            settlementStrategyId: 0,
            acceptablePrice: bn(2000),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          });
        commitTime = await getTxTime(provider(), commitTxn);
      });
    });

    describe('shut down system and ensure settle fails', () => {
      before('set allow all perps system', async () => {
        await systems().PerpsMarket.connect(owner()).setFeatureFlagDenyAll(feature, true);
      });

      it('fails on settle', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).settleOrder(2),
          `FeatureUnavailable("${feature}")`
        );
      });

      it('fails on cancel', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).cancelOrder(2),
          `FeatureUnavailable("${feature}")`
        );
      });
    });

    describe('renable system and settle', () => {
      before('set allow all perps system', async () => {
        await systems().PerpsMarket.connect(owner()).setFeatureFlagAllowAll(feature, true);
      });

      before('open position', async () => {
        await fastForwardTo(commitTime + 500, provider());
        await openPosition({
          systems,
          provider,
          trader: trader1(),
          accountId: 2,
          keeper: trader1(),
          marketId: perpsMarkets()[0].marketId(),
          sizeDelta: bn(1000),
          settlementStrategyId: perpsMarkets()[0].strategyId(),
          price: bn(10),
        });
      });

      it('created position', async () => {
        const { positionSize } = await systems().PerpsMarket.getOpenPosition(
          2,
          perpsMarket.marketId()
        );
        assertBn.equal(positionSize, bn(1000));
      });
    });

    describe('turn off system and check liquidation', () => {
      before('set allow all perps system', async () => {
        await systems().PerpsMarket.connect(owner()).setFeatureFlagDenyAll(feature, true);
      });

      it('fails on liquidate', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(keeper()).liquidate(2),
          `FeatureUnavailable("${feature}")`
        );
        await assertRevert(
          systems().PerpsMarket.connect(keeper()).liquidateFlagged(1),
          `FeatureUnavailable("${feature}")`
        );
        await assertRevert(
          systems().PerpsMarket.connect(keeper()).liquidateFlaggedAccounts([2]),
          `FeatureUnavailable("${feature}")`
        );
      });
    });
  });
});
