import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { depositCollateral } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';

describe('Offchain Async Order - Price tests', () => {
  const { systems, perpsMarkets, provider, trader1, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      },
    ],
    traderAccountIds: [2, 3],
  });

  let ethMarketId: ethers.BigNumber;
  let accountId: number;

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    accountId = 2;
  });

  before('add collateral', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => accountId,
      collaterals: [
        {
          snxUSDAmount: () => bn(10_000),
        },
      ],
    });
  });

  before('set Pyth Benchmark Price data', async () => {
    const offChainPrice = bn(1000);

    // set Pyth setBenchmarkPrice
    await systems().MockPythERC7412Wrapper.setBenchmarkPrice(offChainPrice);
  });

  const restoreToSetCollateralTime = snapshotCheckpoint(provider);

  const testCases = [
    {
      kind: 'long',
      sizeDelta: bn(1),
      acceptablePrice: bn(1050), // 5% slippage
      limitFillPrice: bn(1000.005), // .05bps slippage
      tightFillPrice: bn(1000.004), // 1000.005 is the limit .05bps slippage
    },
    {
      kind: 'short',
      sizeDelta: bn(-1),
      acceptablePrice: bn(950), // 5% slippage
      limitFillPrice: bn(999.995), // .05bps slippage
      tightFillPrice: bn(999.996),
    },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const iter = testCases[i];
    describe(`${iter.kind} order`, () => {
      describe('offchain vs spot price deviation', () => {
        let commitmentTime: number;

        before(restoreToSetCollateralTime);

        before('commit the order and advance in time', async () => {
          const tx = await systems().PerpsMarket.connect(trader1()).commitOrder({
            marketId: ethMarketId,
            accountId: 2,
            sizeDelta: iter.sizeDelta,
            settlementStrategyId: 0,
            acceptablePrice: iter.acceptablePrice,
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          });
          commitmentTime = await getTxTime(provider(), tx);

          // fast forward to settlement
          await fastForwardTo(
            commitmentTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
            provider()
          );
        });

        const restoreToSettleTime = snapshotCheckpoint(provider);

        describe('price at max limit', () => {
          before(restoreToSettleTime);

          before('settles the order', async () => {
            await systems().PerpsMarket.connect(keeper()).settleOrder(accountId);
          });

          it('check position is live', async () => {
            const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
            assertBn.equal(size, iter.sizeDelta);
          });
        });

        describe('price at min limit', () => {
          before(restoreToSettleTime);

          before('settles the order', async () => {
            await systems().PerpsMarket.connect(keeper()).settleOrder(accountId);
          });

          it('check position is live', async () => {
            const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
            assertBn.equal(size, iter.sizeDelta);
          });
        });
      });

      describe('fillPrice deviation check at settlement', () => {
        describe('when fillPrice is not acceptable', () => {
          before(restoreToSetCollateralTime);

          before('commit', async () => {
            const tx = await systems().PerpsMarket.connect(trader1()).commitOrder({
              marketId: ethMarketId,
              accountId: 2,
              sizeDelta: iter.sizeDelta,
              settlementStrategyId: 0,
              acceptablePrice: iter.tightFillPrice,
              referrer: ethers.constants.AddressZero,
              trackingCode: ethers.constants.HashZero,
            });
            const commitmentTime = await getTxTime(provider(), tx);

            // fast forward to settlement
            await fastForwardTo(
              commitmentTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
              provider()
            );
          });

          it('reverts on settle', async () => {
            await assertRevert(
              systems().PerpsMarket.connect(keeper()).settleOrder(accountId),
              `AcceptablePriceExceeded("${iter.limitFillPrice}", "${iter.tightFillPrice}")`
            );
          });
        });

        describe('when fillPrice is acceptable', () => {
          before(restoreToSetCollateralTime);

          before('commit the order with large acceptablePrice and set price', async () => {
            const tx = await systems().PerpsMarket.connect(trader1()).commitOrder({
              marketId: ethMarketId,
              accountId: 2,
              sizeDelta: iter.sizeDelta,
              settlementStrategyId: 0,
              acceptablePrice: iter.limitFillPrice,
              referrer: ethers.constants.AddressZero,
              trackingCode: ethers.constants.HashZero,
            });
            const commitmentTime = await getTxTime(provider(), tx);

            // fast forward to settlement
            await fastForwardTo(
              commitmentTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
              provider()
            );
          });

          before('settles the order', async () => {
            await systems().PerpsMarket.connect(keeper()).settleOrder(accountId);
          });

          it('check position is live', async () => {
            const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
            assertBn.equal(size, iter.sizeDelta);
          });
        });
      });
    });
  }
});
