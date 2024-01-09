import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { createAccountAndOpenPosition, openPosition } from '../helpers';
import { fastForwardTo, getTxTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers } from 'ethers';

describe('Liquidation - flaggedLiquidation', () => {
  const { systems, provider, trader1, trader2, trader3, keeper, owner, perpsMarkets } =
    bootstrapMarkets({
      liquidationGuards: {
        minLiquidationReward: bn(5),
        minKeeperProfitRatioD18: bn(0),
        maxLiquidationReward: bn(1000),
        maxKeeperScalingRatioD18: bn(0),
      },
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
          fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
          liquidationParams: {
            initialMarginFraction: bn(3),
            minimumInitialMarginRatio: bn(0),
            maintenanceMarginScalar: bn(0.5),
            maxLiquidationLimitAccumulationMultiplier: bn(0.1),
            liquidationRewardRatio: bn(0.05),
            maxSecondsInLiquidationWindow: ethers.BigNumber.from(100),
            minimumPositionMargin: bn(0),
          },
          settlementStrategy: {
            settlementReward: bn(0),
          },
        },
      ],
      traderAccountIds: [2, 3, 4],
    });

  let perpsMarket: PerpsMarket;
  let trader2AccountIds: Array<number>;
  before('identify actors', () => {
    perpsMarket = perpsMarkets()[0];
  });

  before('fill trader2 account ids', () => {
    trader2AccountIds = [];
    for (let i = 100; i < 120; i++) {
      trader2AccountIds.push(i);
    }
  });

  before('add collateral to margin for single account', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(1500));
    await systems().PerpsMarket.connect(trader3()).modifyCollateral(4, 0, bn(1500));
  });

  before('open position and balance skew', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: perpsMarket.marketId(),
      sizeDelta: bn(150),
      settlementStrategyId: perpsMarket.strategyId(),
      price: bn(10),
    });

    // use trader 3 to balance skew. Note, this is needed to prevent price drifting when opening the other positions
    await openPosition({
      systems,
      provider,
      trader: trader3(),
      accountId: 4,
      keeper: keeper(),
      marketId: perpsMarket.marketId(),
      sizeDelta: bn(-150),
      settlementStrategyId: perpsMarket.strategyId(),
      price: bn(10),
    });
  });

  before('create multiple accounts for trader 2 and open positions', async () => {
    for (let i = 0; i < trader2AccountIds.length; i++) {
      const id = trader2AccountIds[i];

      await createAccountAndOpenPosition({
        systems,
        provider,
        trader: trader2(),
        accountId: id,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        sizeDelta: bn(150),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(10),
        collateral: bn(1500),
      });

      // balance skew
      await createAccountAndOpenPosition({
        systems,
        provider,
        trader: trader3(),
        accountId: id + 100,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        sizeDelta: bn(-150),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(10),
        collateral: bn(1500),
      });
    }
  });

  before('lower price to liquidation', async () => {
    await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
  });

  /**
   * Based on the above configuration, the max liquidation amount for window == 100
   * * (maker + taker) * skewScale * secondsInWindow * multiplier
   */

  let initialLiquidationTime: number;

  it('should not find any flagged accounts before calling liquidate', async () => {
    const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
    assert.equal(flaggedAccounts.length, 0);
  });

  it('should not revert calling liquidateFlagged', async () => {
    await systems().PerpsMarket.connect(keeper()).liquidateFlagged(5);

    const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
    assert.equal(flaggedAccounts.length, 0);
  });

  it('should not revert calling liquidateFlaggedAccounts', async () => {
    await systems().PerpsMarket.connect(keeper()).liquidateFlaggedAccounts([2, 3, 4, 5, 6]);

    const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
    assert.equal(flaggedAccounts.length, 0);
  });

  describe('when a large account is liquidated/flagged', () => {
    before('call liquidate on first account to use the availability', async () => {
      const tx = await systems().PerpsMarket.connect(keeper()).liquidate(2);
      initialLiquidationTime = await getTxTime(provider(), tx);
    });

    const restore = snapshotCheckpoint(provider);

    describe('when no new accounts are flagged', () => {
      before(restore);

      it('should not find any new flagged accounts', async () => {
        const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
        assert.equal(flaggedAccounts.length, 1);
        assert.equal(flaggedAccounts[0], 2);
      });
    });

    describe('liquidate random accounts (by quantity limit)', () => {
      before(restore);

      before('flag accounts by calling liquidate', async () => {
        for (let i = 0; i < trader2AccountIds.length; i++) {
          const id = trader2AccountIds[i];
          await systems().PerpsMarket.connect(keeper()).liquidate(id);
        }
      });

      it('should find all flagged accounts', async () => {
        const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
        assert.equal(flaggedAccounts.length, 21); // 20 accounts + 1 from before
        assertBn.equal(flaggedAccounts[0], 2);
        assertBn.equal(flaggedAccounts[1], 100);
        assertBn.equal(flaggedAccounts[20], 119);
      });

      describe('liquidate some accounts', () => {
        before('adjust max liquidation in window to allow multiple liquidations', async () => {
          /**
           * Flagged amount = 50 (from account 2) + 20 * 150 (from other accounts = 3050
           * Based on new configuration, the max liquidation amount for window == 1000 * 3.05 = 3050
           * * (maker + taker) * skewScale * secondsInWindow * multiplier
           */

          await systems().PerpsMarket.connect(owner()).setMaxLiquidationParameters(
            perpsMarket.marketId(),
            bn(3.05), // multiplier
            ethers.BigNumber.from(100), // seconds in window
            0, // maxPD
            ethers.constants.AddressZero
          );
        });

        before('fastforward to next window', async () => {
          await fastForwardTo(initialLiquidationTime + 101, provider());
        });

        before('call liquidate flagged (not all the flagged)', async () => {
          await systems().PerpsMarket.connect(keeper()).liquidateFlagged(5);
        });

        it('reduced the number of flagged accounts by 5', async () => {
          const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
          assert.equal(flaggedAccounts.length, 16);
        });

        describe('liquidate the rest', () => {
          before('call liquidate flagged (all the flagged)', async () => {
            await systems().PerpsMarket.connect(keeper()).liquidateFlagged(16);
          });

          it('reduced the number of flagged accounts to 0', async () => {
            const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
            assert.equal(flaggedAccounts.length, 0);
          });
        });
      });
    });

    describe('liquidate selected accounts (all valid)', () => {
      const flaggedAccounts: Array<number> = [];
      before(restore);

      before('flag accounts by calling liquidate', async () => {
        flaggedAccounts.push(2); // already flagged
        for (let i = 0; i < 10; i++) {
          const id = trader2AccountIds[i];
          await systems().PerpsMarket.connect(keeper()).liquidate(id);
          flaggedAccounts.push(id);
        }
      });

      it('should find all flagged accounts', async () => {
        const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
        assert.equal(flaggedAccounts.length, 11); // 10 accounts + 1 from before
        assertBn.equal(flaggedAccounts[0], 2);
        assertBn.equal(flaggedAccounts[1], 100);
        assertBn.equal(flaggedAccounts[10], 109);
      });

      describe('liquidate some accounts', () => {
        before('adjust max liquidation in window to allow multiple liquidations', async () => {
          /**
           * Flagged amount = 50 (from account 2) + 20 * 150 (from other accounts = 3050
           * Based on new configuration, the max liquidation amount for window == 1000 * 3.05 = 3050
           * * (maker + taker) * skewScale * secondsInWindow * multiplier
           */

          await systems().PerpsMarket.connect(owner()).setMaxLiquidationParameters(
            perpsMarket.marketId(),
            bn(3.05), // multiplier
            ethers.BigNumber.from(100), // seconds in window
            0, // maxPD
            ethers.constants.AddressZero
          );
        });

        before('fastforward to next window', async () => {
          await fastForwardTo(initialLiquidationTime + 101, provider());
        });

        before('call liquidate flagged (not all the flagged)', async () => {
          await systems().PerpsMarket.connect(keeper()).liquidateFlaggedAccounts(flaggedAccounts);
        });

        it('reduced the number of flagged accounts by 11 (all flagged)', async () => {
          const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
          assert.equal(flaggedAccounts.length, 0);
        });
      });
    });

    describe('liquidate selected accounts (some not flagged)', () => {
      const flaggedAccounts: Array<number> = [];
      before(restore);

      before('flag accounts by calling liquidate', async () => {
        flaggedAccounts.push(2); // already flagged
        for (let i = 0; i < 10; i++) {
          const id = trader2AccountIds[i];
          await systems().PerpsMarket.connect(keeper()).liquidate(id);
          flaggedAccounts.push(id);
        }
        for (let i = 10; i < 20; i++) {
          flaggedAccounts.push(trader2AccountIds[i]);
        }
      });

      it('should find all flagged accounts', async () => {
        const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
        assert.equal(flaggedAccounts.length, 11); // 10 accounts + 1 from before
        assertBn.equal(flaggedAccounts[0], 2);
        assertBn.equal(flaggedAccounts[1], 100);
        assertBn.equal(flaggedAccounts[10], 109);
      });

      describe('liquidate some accounts', () => {
        before('adjust max liquidation in window to allow multiple liquidations', async () => {
          /**
           * Flagged amount = 50 (from account 2) + 20 * 150 (from other accounts = 3050
           * Based on new configuration, the max liquidation amount for window == 1000 * 3.05 = 3050
           * * (maker + taker) * skewScale * secondsInWindow * multiplier
           */

          await systems().PerpsMarket.connect(owner()).setMaxLiquidationParameters(
            perpsMarket.marketId(),
            bn(3.05), // multiplier
            ethers.BigNumber.from(100), // seconds in window
            0, // maxPD
            ethers.constants.AddressZero
          );
        });

        before('fastforward to next window', async () => {
          await fastForwardTo(initialLiquidationTime + 101, provider());
        });

        before('call liquidate flagged (not all the flagged)', async () => {
          await systems().PerpsMarket.connect(keeper()).liquidateFlaggedAccounts(flaggedAccounts);
        });

        it('reduced the number of flagged accounts by 11 (all flagged)', async () => {
          const flaggedAccounts = await systems().PerpsMarket.flaggedAccounts();
          assert.equal(flaggedAccounts.length, 0);
        });
      });
    });
  });
});
