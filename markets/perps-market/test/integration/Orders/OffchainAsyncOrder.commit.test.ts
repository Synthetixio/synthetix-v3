import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SetCollateralData, depositCollateral, settleOrder } from '../helpers';
import assert from 'assert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Commit Offchain Async Order test', () => {
  const { systems, perpsMarkets, synthMarkets, provider, trader1, keeper } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(10_000),
        sellPrice: bn(10_000),
      },
    ],
    perpsMarkets: [
      {
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      },
    ],
    traderAccountIds: [2, 3],
  });
  let ethMarketId: ethers.BigNumber;
  let btcSynthId: ethers.BigNumber;

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    btcSynthId = synthMarkets()[0].marketId();
  });

  describe('failures', () => {
    it('reverts if market id is incorrect', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 1337,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1000),
            trackingCode: ethers.constants.HashZero,
          }),
        'InvalidMarket("1337")'
      );
    });

    it('reverts if account is invalid', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: ethMarketId,
            accountId: 1337,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1000),
            trackingCode: ethers.constants.HashZero,
          }),
        'AccountNotFound("1337")'
      );
    });

    it(`reverts if account doesn't have margin`, async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: ethMarketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1000),
            trackingCode: ethers.constants.HashZero,
          }),
        'InsufficientMargin'
      );
    });
  });

  const restoreToCommit = snapshotCheckpoint(provider);

  const testCases: Array<{ name: string; collateralData: SetCollateralData }> = [
    {
      name: 'only snxUSD',
      collateralData: {
        trader: trader1,
        accountId: () => 2,
        trades: [
          {
            synthName: () => 'snxUSD',
            synthMarketId: () => 0,
            synthMarket: synthMarkets()[0].synth,
            marginAmount: () => 0,
            synthAmount: () => bn(10_000),
          },
        ],
      },
    },
    {
      name: 'only snxBTC',
      collateralData: {
        trader: trader1,
        accountId: () => 2,
        trades: [
          {
            synthName: () => 'snxBTC',
            synthMarketId: () => btcSynthId,
            synthMarket: synthMarkets()[0].synth,
            marginAmount: () => bn(10_000),
            synthAmount: () => bn(1),
          },
        ],
      },
    },
    {
      name: 'snxUSD and snxBTC',
      collateralData: {
        trader: trader1,
        accountId: () => 2,
        trades: [
          {
            synthName: () => 'snxUSD',
            synthMarketId: () => 0,
            synthMarket: synthMarkets()[0].synth,
            marginAmount: () => 0,
            synthAmount: () => bn(2), // less than needed to pay for settlementReward
          },
          {
            synthName: () => 'snxBTC',
            synthMarketId: () => btcSynthId,
            synthMarket: synthMarkets()[0].synth,
            marginAmount: () => bn(10_000),
            synthAmount: () => bn(1),
          },
        ],
      },
    },
  ];

  for (const testCase of testCases) {
    describe(`Using ${testCase.name} as collateral`, () => {
      let tx: ethers.ContractTransaction;
      let startTime: number;

      before(restoreToCommit);

      before('add collateral', async () => {
        await depositCollateral(testCase.collateralData, { systems, provider });
      });

      before('commit the order', async () => {
        tx = await systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: ethMarketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1000),
            trackingCode: ethers.constants.HashZero,
          });
        await tx.wait();
        startTime = await getTime(provider());
      });

      it('emit event', async () => {
        await assertEvent(
          tx,
          `OrderCommitted(${ethMarketId}, 2, ${DEFAULT_SETTLEMENT_STRATEGY.strategyType}, ${bn(
            1
          )}, ${bn(1000)}, ${startTime + 5}, ${startTime + 5 + 120}, "${
            ethers.constants.HashZero
          }", "${await trader1().getAddress()}")`,
          systems().PerpsMarket
        );
      });

      it('identifies the pending order', async () => {
        const ayncOrderClaim = await systems().PerpsMarket.getAsyncOrderClaim(2, ethMarketId);
        assertBn.equal(ayncOrderClaim.accountId, 2);
        assertBn.equal(ayncOrderClaim.marketId, ethMarketId);
        assertBn.equal(ayncOrderClaim.sizeDelta, bn(1));
        assertBn.equal(ayncOrderClaim.settlementStrategyId, 0);
        assertBn.equal(ayncOrderClaim.settlementTime, startTime + 5);
        assertBn.equal(ayncOrderClaim.acceptablePrice, bn(1000));
        assert.equal(ayncOrderClaim.trackingCode, ethers.constants.HashZero);
      });

      it('reverts if attempt to commit another order for same account and market', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(trader1())
            .commitOrder({
              marketId: ethMarketId,
              accountId: 2,
              sizeDelta: bn(2),
              settlementStrategyId: 0,
              acceptablePrice: bn(1000),
              trackingCode: ethers.constants.HashZero,
            }),
          `OrderAlreadyCommitted("${ethMarketId}", "2")`
        );
      });

      describe('can settle order', () => {
        before('settle', async () => {
          const settlementTime = startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1;
          await fastForwardTo(settlementTime, provider());
          await settleOrder({
            systems,
            keeper: keeper(),
            marketId: ethMarketId,
            accountId: 2,
            feedId: DEFAULT_SETTLEMENT_STRATEGY.feedId,
            settlementTime,
            offChainPrice: 1000,
          });
        });

        it('check position is live', async () => {
          const [pnl, funding, size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
          assertBn.equal(pnl, bn(-0.005));
          assertBn.equal(funding, bn(0));
          assertBn.equal(size, bn(1));
        });

        describe('can commit another order after settlement', () => {
          before('commit the order', async () => {
            tx = await systems()
              .PerpsMarket.connect(trader1())
              .commitOrder({
                marketId: ethMarketId,
                accountId: 2,
                sizeDelta: bn(1),
                settlementStrategyId: 0,
                acceptablePrice: bn(1000),
                trackingCode: ethers.constants.HashZero,
              });
            await tx.wait();
            startTime = await getTime(provider());
          });

          it('emit event', async () => {
            await assertEvent(
              tx,
              `OrderCommitted(${ethMarketId}, 2, ${DEFAULT_SETTLEMENT_STRATEGY.strategyType}, ${bn(
                1
              )}, ${bn(1000)}, ${startTime + 5}, ${startTime + 5 + 120}, "${
                ethers.constants.HashZero
              }", "${await trader1().getAddress()}")`,
              systems().PerpsMarket
            );
          });

          it('identifies the pending order', async () => {
            const ayncOrderClaim = await systems().PerpsMarket.getAsyncOrderClaim(2, ethMarketId);
            assertBn.equal(ayncOrderClaim.accountId, 2);
            assertBn.equal(ayncOrderClaim.marketId, ethMarketId);
            assertBn.equal(ayncOrderClaim.sizeDelta, bn(1));
            assertBn.equal(ayncOrderClaim.settlementStrategyId, 0);
            assertBn.equal(ayncOrderClaim.settlementTime, startTime + 5);
            assertBn.equal(ayncOrderClaim.acceptablePrice, bn(1000));
            assert.equal(ayncOrderClaim.trackingCode, ethers.constants.HashZero);
          });
        });
      });
    });
  }
});
