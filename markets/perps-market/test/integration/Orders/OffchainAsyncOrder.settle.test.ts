import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { DepositCollateralData, depositCollateral } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';
import { calculateFillPrice, calculatePricePnl } from '../helpers/fillPrice';
import { wei } from '@synthetixio/wei';
import { calcCurrentFundingVelocity } from '../helpers/funding-calcs';
import { deepEqual } from 'assert/strict';

describe('Settle Offchain Async Order test', () => {
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

  before('set Pyth Benchmark Price data', async () => {
    const offChainPrice = bn(1000);

    // set Pyth setBenchmarkPrice
    await systems().MockPythERC7412Wrapper.setBenchmarkPrice(offChainPrice);
  });

  describe('failures before commiting orders', () => {
    describe('using settle', () => {
      it('reverts if account id is incorrect (not valid order)', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).settleOrder(1337),
          'OrderNotValid()'
        );
      });

      it('reverts if order was not settled before (not valid order)', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).settleOrder(2),
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

      describe('attempts to settle before settlement time', () => {
        before(restoreBeforeSettle);

        it('with settleOrder', async () => {
          await assertRevert(
            systems().PerpsMarket.connect(trader1()).settleOrder(2),
            'SettlementWindowNotOpen'
          );
        });
      });

      describe('attempts to settle after settlement window', () => {
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

        it('with settleOrder', async () => {
          await assertRevert(
            systems().PerpsMarket.connect(keeper()).settleOrder(2),
            'SettlementWindowExpired'
          );
        });
      });

      describe('attempts to settle with invalid pyth price data', () => {
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
            `OracleDataRequired("${DEFAULT_SETTLEMENT_STRATEGY.feedId}", ${startTime + 2})`
          );
        });
      });

      describe('attempts to settle with not enough collateral', () => {
        // Note: This tests is not valid for the "only snxUSD" case
        before(restoreBeforeSettle);

        before('fast forward to settlement time', async () => {
          // fast forward to settlement
          await fastForwardTo(
            startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
            provider()
          );
        });

        before('update collateral price', async () => {
          await btcSynth.sellAggregator().mockSetCurrentPrice(bn(0.1));
        });

        it('reverts with invalid pyth price timestamp (after time)', async () => {
          if (testCase.name === 'only snxUSD') {
            return;
          }

          const currentSkew = await systems().PerpsMarket.skew(ethMarketId);
          const startingPnl = calculatePricePnl(wei(currentSkew), wei(100_000), wei(1), wei(1000));
          const availableCollateral = (testCase.name === 'only snxBTC' ? wei(0.1) : wei(2.1)).add(
            startingPnl
          );

          await assertRevert(
            systems().PerpsMarket.connect(keeper()).settleOrder(2),
            `InsufficientMargin("${availableCollateral.bn}", "${bn(5).toString()}")`
          );
        });
      });

      describe('settle order', () => {
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
              systems().PerpsMarket.connect(trader1()).settleOrder(2),
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

        describe('settle order', () => {
          let settleTx: ethers.ContractTransaction;

          before('settle', async () => {
            settleTx = await systems().PerpsMarket.connect(keeper()).settleOrder(2);
          });

          it('emits settle event', async () => {
            const accountId = 2;
            const fillPrice = calculateFillPrice(wei(0), wei(100_000), wei(1), wei(1000)).toBN();
            const sizeDelta = bn(1);
            const newPositionSize = bn(1);
            const totalFees = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;
            const settlementReward = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;
            const trackingCode = `"${ethers.constants.HashZero}"`;
            const msgSender = `"${await keeper().getAddress()}"`;
            const params = [
              ethMarketId,
              accountId,
              fillPrice,
              0,
              0,
              sizeDelta,
              newPositionSize,
              totalFees,
              0, // referral fees
              0, // collected fees
              settlementReward,
              trackingCode,
              msgSender,
            ];
            await assertEvent(
              settleTx,
              `OrderSettled(${params.join(', ')})`,
              systems().PerpsMarket
            );
          });

          it('emits AccountCharged event', async () => {
            const snxUsdAmount =
              testCase.collateralData.collaterals[0].synthMarket === undefined
                ? testCase.collateralData.collaterals[0].snxUSDAmount()
                : bn(0);
            const chargeAmount = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;
            const accruedDebt = chargeAmount.gt(snxUsdAmount)
              ? chargeAmount.sub(snxUsdAmount)
              : bn(0);
            await assertEvent(
              settleTx,
              `AccountCharged(2, ${chargeAmount.mul(-1)}, ${accruedDebt})`,
              systems().PerpsMarket
            );
          });

          it('emits market updated event', async () => {
            const price = bn(1000);
            const marketSize = bn(1);
            const marketSkew = bn(1);
            const sizeDelta = bn(1);
            const currentFundingRate = bn(0);
            const currentFundingVelocity = calcCurrentFundingVelocity({
              skew: wei(1),
              skewScale: wei(100_000),
              maxFundingVelocity: wei(10),
            });
            const params = [
              ethMarketId,
              price,
              marketSkew,
              marketSize,
              sizeDelta,
              currentFundingRate,
              currentFundingVelocity.toBN(), // Funding rates should be tested more thoroughly elsewhre
              0, // interest rate is 0 since no params were set
            ];
            await assertEvent(
              settleTx,
              `MarketUpdated(${params.join(', ')})`,
              systems().PerpsMarket
            );
          });

          it('check position is live', async () => {
            const [pnl, funding, size] = await systems().PerpsMarket.getOpenPosition(
              2,
              ethMarketId
            );
            assertBn.equal(pnl, bn(-0.005));
            assertBn.equal(funding, bn(0));
            assertBn.equal(size, bn(1));
          });

          it('check position size', async () => {
            const size = await systems().PerpsMarket.getOpenPositionSize(2, ethMarketId);
            assertBn.equal(size, bn(1));
          });

          it('check account open position market ids', async () => {
            const positions = await systems().PerpsMarket.getAccountOpenPositions(2);
            deepEqual(positions, [ethMarketId]);
          });
        });
      });
    });
  }
});
