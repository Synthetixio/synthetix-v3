import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { PerpsMarketProxy } from '../../generated/typechain';
import { openPosition } from '../helpers';

describe.only('Account margins test', () => {
  const accountId = 4;
  const { systems, provider, trader1, perpsMarkets } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Bitcoin',
        token: 'BTC',
        price: bn(30_000),
        fundingParams: { skewScale: bn(100), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: bn(2),
          maintenanceMarginFraction: bn(1),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: bn(0.05),
          maxSecondsInLiquidationWindow: bn(10),
          minimumPositionMargin: bn(1000),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
      },
      {
        requestedMarketId: 26,
        name: 'Ether',
        token: 'ETH',
        price: bn(2000),
        fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: bn(2),
          maintenanceMarginFraction: bn(1),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: bn(0.05),
          maxSecondsInLiquidationWindow: bn(10),
          minimumPositionMargin: bn(500),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
      },
    ],
    traderAccountIds: [accountId, 5],
  });

  // add $100k
  before('add some snx collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(accountId, 0, bn(100_000));
  });

  describe('before open positions', () => {
    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(accountId), bn(100_000));
    });

    it('has correct withdrawable margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getWithdrawableMargin(accountId), bn(100_000));
    });

    it('has correct initial and maintenance margin', async () => {
      const [initialMargin, maintenanceMargin] = await systems().PerpsMarket.getRequiredMargins(
        accountId
      );
      assertBn.equal(initialMargin, 0);
      assertBn.equal(maintenanceMargin, 0);
    });
  });

  describe('after open positions', () => {
    before('open 2 positions', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: trader1(),
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(-2),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: bn(30_000),
      });
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: trader1(),
        marketId: perpsMarkets()[1].marketId(),
        sizeDelta: bn(20),
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: bn(2_000),
      });
    });

    it('has correct available margin', async () => {});
  });
});
