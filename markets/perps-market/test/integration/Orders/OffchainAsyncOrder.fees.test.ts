import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets, decimalMul } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import {
  DepositCollateralData,
  OpenPositionData,
  depositCollateral,
  openPosition,
  settleOrder,
} from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';

describe('Offchain Async Order test - fees', () => {
  const orderFees = {
    makerFee: bn(0.0003), // 3bps
    takerFee: bn(0.0008), // 8bps
  };
  const ethPrice = bn(1000);

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
        price: ethPrice,
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
        orderFees,
      },
    ],
    traderAccountIds: [2, 3],
  });
  let ethMarketId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    btcSynth = synthMarkets()[0];
  });

  const restoreToDepositCollateral = snapshotCheckpoint(provider);

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
    // {
    //   name: 'only snxBTC',
    //   collateralData: {
    //     systems,
    //     trader: trader1,
    //     accountId: () => 2,
    //     collaterals: [
    //       {
    //         synthMarket: () => btcSynth,
    //         snxUSDAmount: () => bn(10_000),
    //       },
    //     ],
    //   },
    // },
    // {
    //   name: 'snxUSD and snxBTC',
    //   collateralData: {
    //     systems,
    //     trader: trader1,
    //     accountId: () => 2,
    //     collaterals: [
    //       {
    //         snxUSDAmount: () => bn(2), // less than needed to pay for settlementReward
    //       },
    //       {
    //         synthMarket: () => btcSynth,
    //         snxUSDAmount: () => bn(10_000),
    //       },
    //     ],
    //   },
    // },
  ];

  for (let idx = 0; idx < testCases.length; idx++) {
    const testCase = testCases[idx];
    describe(`Using ${testCase.name} as collateral`, () => {
      let balancesBeforeLong: {
        traderBalance: ethers.BigNumber;
        perpMarketWithdrawable: ethers.BigNumber;
        keeperBalance: ethers.BigNumber;
      };

      before(restoreToDepositCollateral);

      before('add collateral', async () => {
        await depositCollateral(testCase.collateralData);
      });

      before('capture initial values', async () => {
        balancesBeforeLong = await getBalances();
      });

      const restoreToSetOrder = snapshotCheckpoint(provider);

      describe('single order - intermediate steps', () => {
        let tx: ethers.ContractTransaction;
        let startTime: number;
        let feesPaidOnSettle: ReturnType<typeof computeFees>;

        before(restoreToSetOrder);

        before('commit the order', async () => {
          const sizeDelta = bn(1);
          tx = await systems()
            .PerpsMarket.connect(trader1())
            .commitOrder({
              marketId: ethMarketId,
              accountId: 2,
              sizeDelta,
              settlementStrategyId: 0,
              acceptablePrice: bn(1050), // 5% slippage
              trackingCode: ethers.constants.HashZero,
            });

          startTime = await getTxTime(provider(), tx);
          feesPaidOnSettle = computeFees(
            bn(0),
            sizeDelta,
            await systems().PerpsMarket.fillPrice(ethMarketId, sizeDelta, ethPrice)
          );
        });

        it('validate that not fees are paid on commit', async () => {
          const { traderBalance, perpMarketWithdrawable, keeperBalance } = await getBalances();

          assertBn.equal(traderBalance, balancesBeforeLong.traderBalance);
          assertBn.equal(perpMarketWithdrawable, balancesBeforeLong.perpMarketWithdrawable);
          assertBn.equal(keeperBalance, balancesBeforeLong.keeperBalance);
        });

        const restoreToKeeper = snapshotCheckpoint(provider);

        describe('when canceling the order', () => {
          before(restoreToKeeper);

          before('cancel the order', async () => {
            await fastForwardTo(
              startTime +
                DEFAULT_SETTLEMENT_STRATEGY.settlementDelay +
                DEFAULT_SETTLEMENT_STRATEGY.settlementWindowDuration +
                1,
              provider()
            );
            tx = await systems().PerpsMarket.cancelOrder(ethMarketId, 2);
          });

          it('validate no fees are paid on cancel', async () => {
            const { traderBalance, perpMarketWithdrawable, keeperBalance } = await getBalances();

            assertBn.equal(traderBalance, balancesBeforeLong.traderBalance);
            assertBn.equal(perpMarketWithdrawable, balancesBeforeLong.perpMarketWithdrawable);
            assertBn.equal(keeperBalance, balancesBeforeLong.keeperBalance);
          });
        });

        describe('when settling the order', () => {
          before(restoreToKeeper);

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

          it('validate fees paid on settle', async () => {
            const { traderBalance, perpMarketWithdrawable, keeperBalance } = await getBalances();

            assertBn.equal(
              traderBalance,
              balancesBeforeLong.traderBalance.sub(feesPaidOnSettle.totalFees)
            );
            assertBn.equal(
              perpMarketWithdrawable,
              balancesBeforeLong.perpMarketWithdrawable.add(feesPaidOnSettle.perpsMarketFee)
            );
            assertBn.equal(
              keeperBalance,
              balancesBeforeLong.keeperBalance.add(feesPaidOnSettle.keeperFee)
            );
          });
        });
      });

      describe('multiple orders ', () => {
        let feesPaidOnLong: ReturnType<typeof computeFees>;

        let balancesAfterLong: {
          traderBalance: ethers.BigNumber;
          perpMarketWithdrawable: ethers.BigNumber;
          keeperBalance: ethers.BigNumber;
        };

        let commonOpenPositionProps: Pick<
          OpenPositionData,
          | 'systems'
          | 'provider'
          | 'trader'
          | 'accountId'
          | 'keeper'
          | 'marketId'
          | 'settlementStrategyId'
        >;

        const initialLongSize = bn(2);

        before(restoreToSetOrder);

        before('identify common props', async () => {
          commonOpenPositionProps = {
            systems,
            provider,
            marketId: ethMarketId,
            trader: trader1(),
            accountId: 2,
            keeper: keeper(),
            settlementStrategyId: bn(0),
          };
        });

        before('open a long order (taker)', async () => {
          feesPaidOnLong = computeFees(
            bn(0),
            initialLongSize,
            await systems().PerpsMarket.fillPrice(ethMarketId, initialLongSize, ethPrice)
          );

          await openPosition({
            ...commonOpenPositionProps,
            sizeDelta: initialLongSize,
            price: ethPrice,
          });
        });

        before('capture initial values', async () => {
          balancesAfterLong = await getBalances();
        });

        it('validate fees paid on long position', async () => {
          assertBn.equal(
            balancesAfterLong.traderBalance,
            balancesBeforeLong.traderBalance.sub(feesPaidOnLong.totalFees)
          );
          assertBn.equal(
            balancesAfterLong.perpMarketWithdrawable,
            balancesBeforeLong.perpMarketWithdrawable.add(feesPaidOnLong.perpsMarketFee)
          );
          assertBn.equal(
            balancesAfterLong.keeperBalance,
            balancesBeforeLong.keeperBalance.add(feesPaidOnLong.keeperFee)
          );
        });

        const restoreToLongOrder = snapshotCheckpoint(provider);

        describe('reduce position size (maker)', () => {
          let feesPaidOnShort: ReturnType<typeof computeFees>;
          const sizeDelta = bn(-1); // original size is 2, reduce by 1 => still long, but smaller

          before(restoreToLongOrder);

          before('open a small short order', async () => {
            feesPaidOnShort = computeFees(
              initialLongSize,
              sizeDelta,
              await systems().PerpsMarket.fillPrice(ethMarketId, sizeDelta, ethPrice)
            );

            console.log(
              'feesPaidOnShort - fixed price',
              computeFees(initialLongSize, sizeDelta, ethPrice)
            );
            console.log('feesPaidOnShort - fill price ', feesPaidOnShort);

            console.log('- fixed price', ethPrice);
            console.log(
              '- fill price ',
              await systems().PerpsMarket.fillPrice(ethMarketId, sizeDelta, ethPrice)
            );

            await openPosition({
              ...commonOpenPositionProps,
              sizeDelta,
              price: ethPrice,
            });
          });

          it('validate fees paid on short position', async () => {
            const { traderBalance, perpMarketWithdrawable, keeperBalance } = await getBalances();
            console.log('feesPaidOnShort', feesPaidOnShort);
            console.log(
              balancesAfterLong.traderBalance.toString(),
              balancesAfterLong.perpMarketWithdrawable.toString(),
              balancesAfterLong.keeperBalance.toString()
            );
            console.log(
              traderBalance.toString(),
              perpMarketWithdrawable.toString(),
              keeperBalance.toString()
            );

            assertBn.equal(
              traderBalance,
              balancesAfterLong.traderBalance.sub(feesPaidOnShort.totalFees)
            );
            assertBn.equal(
              perpMarketWithdrawable,
              balancesAfterLong.perpMarketWithdrawable.add(feesPaidOnShort.perpsMarketFee)
            );
            assertBn.equal(
              keeperBalance,
              balancesAfterLong.keeperBalance.add(feesPaidOnShort.keeperFee)
            );
          });
        });

        describe.skip('flip the order side (maker + taker)', () => {
          let feesPaidOnShort: ReturnType<typeof computeFees>;
          const sizeDelta = bn(-3); // original size is 2, reduce by 3 => flip to short -1

          before(restoreToLongOrder);

          before('open a large short order', async () => {
            feesPaidOnShort = computeFees(
              initialLongSize,
              sizeDelta,
              await systems().PerpsMarket.fillPrice(ethMarketId, sizeDelta, ethPrice)
            );

            await openPosition({
              ...commonOpenPositionProps,
              sizeDelta,
              price: ethPrice,
            });
          });

          it('validate fees paid', async () => {
            const { traderBalance, perpMarketWithdrawable, keeperBalance } = await getBalances();

            assertBn.equal(
              traderBalance,
              balancesAfterLong.traderBalance.sub(feesPaidOnShort.totalFees)
            );
            assertBn.equal(
              perpMarketWithdrawable,
              balancesAfterLong.perpMarketWithdrawable.add(feesPaidOnShort.perpsMarketFee)
            );
            assertBn.equal(
              keeperBalance,
              balancesAfterLong.keeperBalance.add(feesPaidOnShort.keeperFee)
            );
          });
        });
      });
    });
  }

  const getBalances = async () => {
    const traderBalance = await systems().PerpsMarket.totalCollateralValue(2);
    const perpMarketWithdrawable = await systems().Core.getWithdrawableMarketUsd(ethMarketId);
    const keeperBalance = await systems().USD.balanceOf(keeper().getAddress());
    return {
      traderBalance,
      perpMarketWithdrawable,
      keeperBalance,
    };
  };

  const computeFees: (
    sizeBefore: ethers.BigNumber,
    sizeDelta: ethers.BigNumber,
    price: ethers.BigNumber
  ) => {
    totalFees: ethers.BigNumber;
    keeperFee: ethers.BigNumber;
    perpsMarketFee: ethers.BigNumber;
  } = (sizeBefore, sizeDelta, price) => {
    let makerSize = bn(0),
      takerSize = bn(0);

    if (sizeDelta.isZero()) {
      // no change in fees
    } else if (sizeBefore.isZero() || sizeBefore.mul(sizeDelta).gt(0)) {
      // same side. taker
      takerSize = sizeDelta.abs();
    } else {
      makerSize = sizeBefore.abs() > sizeDelta.abs() ? sizeDelta.abs() : sizeBefore.abs();
      takerSize =
        sizeBefore.abs() < sizeDelta.abs() ? sizeDelta.abs().sub(sizeBefore.abs()) : bn(0);
    }

    const notionalTaker = decimalMul(takerSize, price);
    const notionalMaker = decimalMul(makerSize, price);

    const perpsMarketFee = decimalMul(notionalMaker, orderFees.makerFee).add(
      decimalMul(notionalTaker, orderFees.takerFee)
    );
    const keeperFee = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;

    return { totalFees: perpsMarketFee.add(keeperFee), perpsMarketFee, keeperFee };
  };
});
