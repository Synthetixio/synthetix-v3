import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { DepositCollateralData, depositCollateral } from '../helpers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';
import { calculateFillPrice } from '../helpers/fillPrice';
import { wei } from '@synthetixio/wei';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { deepEqual } from 'assert';

describe('Cancel Offchain Async Order test', () => {
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
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
      },
    ],
    traderAccountIds: [2, 3],
  });
  let ethMarketId: ethers.BigNumber;
  let ethSettlementStrategyId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    ethSettlementStrategyId = perpsMarkets()[0].strategyId();
    btcSynth = synthMarkets()[0];
  });

  describe('failures before commiting orders', () => {
    describe('using cancelOrder', () => {
      it('reverts if account id is incorrect (not valid order)', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).cancelOrder(1337),
          'OrderNotValid()'
        );
      });
    });
  });

  const restoreToCommit = snapshotCheckpoint(provider);

  const testCases: Array<{ name: string; collateralData: DepositCollateralData }> = [
    {
      name: 'only snxUSD',
      collateralData: {
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            snxUSDAmount: () => bn(10_000),
          },
        ],
      },
    },
    {
      name: 'only snxBTC',
      collateralData: {
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            synthMarket: () => btcSynth,
            snxUSDAmount: () => bn(10_000),
          },
        ],
      },
    },
    {
      name: 'snxUSD and snxBTC',
      collateralData: {
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            snxUSDAmount: () => bn(2), // less than needed to pay for settlementReward
          },
          {
            synthMarket: () => btcSynth,
            snxUSDAmount: () => bn(10_000),
          },
        ],
      },
    },
  ];

  for (let idx = 0; idx < testCases.length; idx++) {
    const testCase = testCases[idx];
    describe(`Using ${testCase.name} as collateral`, () => {
      let tx: ethers.ContractTransaction;
      let startTime: number;

      before(restoreToCommit);

      before('add collateral', async () => {
        await depositCollateral(testCase.collateralData);
      });

      before('commit the order', async () => {
        tx = await systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: ethMarketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1050), // 5% slippage
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          });
        startTime = await getTxTime(provider(), tx);
      });

      const restoreBeforeSettle = snapshotCheckpoint(provider);

      describe('attempts to cancel before settlement time', () => {
        before(restoreBeforeSettle);

        it('with settle', async () => {
          await assertRevert(
            systems().PerpsMarket.connect(trader1()).cancelOrder(2),
            'SettlementWindowNotOpen'
          );
        });
      });

      describe('attempts to cancel after settlement window', () => {
        before(restoreBeforeSettle);

        before('fast forward to past settlement window', async () => {
          // fast forward to settlement
          await fastForwardTo(
            startTime +
              DEFAULT_SETTLEMENT_STRATEGY.settlementDelay +
              DEFAULT_SETTLEMENT_STRATEGY.settlementWindowDuration +
              1,
            provider()
          );
        });

        it('with settle', async () => {
          await assertRevert(
            systems().PerpsMarket.connect(trader1()).cancelOrder(2),
            'SettlementWindowExpired'
          );
        });
      });

      describe('attempts to cancel with issues in pyth price data', () => {
        before(restoreBeforeSettle);

        before('fast forward to settlement time', async () => {
          // fast forward to settlement
          await fastForwardTo(
            startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
            provider()
          );
        });

        it('reverts when there is no benchmark price', async () => {
          // set Pyth setBenchmarkPrice
          await systems().MockPythERC7412Wrapper.setAlwaysRevertFlag(true);

          await assertRevert(
            systems().PerpsMarket.connect(keeper()).settleOrder(2),
            `OracleDataRequired(${DEFAULT_SETTLEMENT_STRATEGY.feedId}, ${startTime + 2})`
          );
        });

        it('reverts with invalid pyth price (acceptable price)', async () => {
          await systems().MockPythERC7412Wrapper.setBenchmarkPrice(bn(1000));

          await assertRevert(
            systems().PerpsMarket.connect(keeper()).cancelOrder(2),
            `PriceNotExceeded("${bn(1000.005)}", "${bn(1050)}")`
          );
        });
      });

      describe('cancel order', () => {
        before(restoreBeforeSettle);

        before('fast forward to settlement time', async () => {
          // fast forward to settlement
          await fastForwardTo(
            startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
            provider()
          );
        });

        describe('disable settlement strategy', () => {
          before(async () => {
            await systems().PerpsMarket.setSettlementStrategyEnabled(
              ethMarketId,
              ethSettlementStrategyId,
              false
            );
          });

          it('reverts with invalid settlement strategy', async () => {
            await assertRevert(
              systems().PerpsMarket.connect(trader1()).cancelOrder(2),
              'InvalidSettlementStrategy'
            );
          });

          after(async () => {
            await systems().PerpsMarket.setSettlementStrategyEnabled(
              ethMarketId,
              ethSettlementStrategyId,
              true
            );
          });
        });

        describe('cancel pyth order', () => {
          let cancelTx: ethers.ContractTransaction;
          let accountBalanceBefore: ethers.BigNumber;
          let keeperBalanceBefore: ethers.BigNumber;
          let expectedDebt: ethers.BigNumber;
          const settlementReward = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;

          before('collect initial balances', async () => {
            // if snxUSD available, subtract settlementReward from snxUSD otherwise add to debt
            const startingSnxUSDBalance = await systems().PerpsMarket.getCollateralAmount(2, 0);
            const leftoverSnxUsd = startingSnxUSDBalance.sub(settlementReward);
            expectedDebt = leftoverSnxUsd.lt(0) ? leftoverSnxUsd.abs() : wei(0).toBN();

            accountBalanceBefore = await systems().PerpsMarket.getAvailableMargin(2);
            keeperBalanceBefore = await systems().USD.balanceOf(await keeper().getAddress());
          });

          before('set benchmark price', async () => {
            await systems().MockPythERC7412Wrapper.setBenchmarkPrice(bn(1051));
          });

          before('cancelOrder', async () => {
            cancelTx = await systems().PerpsMarket.connect(keeper()).cancelOrder(2);
          });

          it('emits cancelOrder event', async () => {
            const accountId = 2;
            const fillPrice = calculateFillPrice(wei(0), wei(100_000), wei(1), wei(1051)).toBN();
            const sizeDelta = bn(1);
            const desiredPrice = bn(1050);
            const trackingCode = `"${ethers.constants.HashZero}"`;
            const msgSender = `"${await keeper().getAddress()}"`;
            const params = [
              ethMarketId,
              accountId,
              desiredPrice,
              fillPrice,
              sizeDelta,
              settlementReward,
              trackingCode,
              msgSender,
            ];
            await assertEvent(
              cancelTx,
              `OrderCancelled(${params.join(', ')})`,
              systems().PerpsMarket
            );
          });

          it('emits AccountCharged event', async () => {
            const params = [2, settlementReward, expectedDebt];
            await assertEvent(
              cancelTx,
              `AccountCharged(${params.join(', ')})`,
              systems().PerpsMarket
            );
          });

          it('updates balances accordingly', async () => {
            const accountBalanceAfter = await systems().PerpsMarket.getAvailableMargin(2);
            const keeperBalanceAfter = await systems().USD.balanceOf(await keeper().getAddress());
            assertBn.equal(keeperBalanceAfter, keeperBalanceBefore.add(settlementReward));
            assertBn.equal(accountBalanceAfter, accountBalanceBefore.sub(settlementReward));

            assertBn.equal(await systems().PerpsMarket.debt(2), expectedDebt);
          });

          it('check account open position market ids', async () => {
            const positions = await systems().PerpsMarket.getAccountOpenPositions(2);
            deepEqual(positions, []);
          });
        });
      });
    });
  }
});
