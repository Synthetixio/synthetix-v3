import { BigNumberish, ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import {
  Fees,
  OpenPositionData,
  computeFees,
  depositCollateral,
  openPosition,
  settleOrder,
} from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';
import Wei, { wei } from '@synthetixio/wei';

describe('Offchain Async Order test - fees', () => {
  const orderFees = {
    makerFee: wei(0.0003), // 3bps
    takerFee: wei(0.0008), // 8bps
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
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: ethPrice,
        // setting to 0 to avoid funding and p/d price change affecting pnl
        fundingParams: { skewScale: bn(0), maxFundingVelocity: bn(0) },
        orderFees: {
          makerFee: orderFees.makerFee.toBN(),
          takerFee: orderFees.takerFee.toBN(),
        },
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

  const testCases = [
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
      availableUsdAmount: bn(10_000), // using this to track snxUSDAmount
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
      availableUsdAmount: bn(0), // only snxBTC so in this case, fees/pnl added to debt
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
      availableUsdAmount: bn(2),
    },
  ];

  for (const testCase of testCases) {
    describe(`Using ${testCase.name} as collateral`, () => {
      let balancesBeforeLong: {
        traderBalance: ethers.BigNumber;
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
        let feesPaidOnSettle: Fees;

        before(restoreToSetOrder);

        let fillPrice: Wei;
        const sizeDelta = bn(1);

        before('get fill price', async () => {
          fillPrice = wei(await systems().PerpsMarket.fillPrice(ethMarketId, sizeDelta, ethPrice));
          feesPaidOnSettle = computeFees(wei(0), wei(sizeDelta), fillPrice, orderFees);
        });

        before('commit the order', async () => {
          tx = await systems()
            .PerpsMarket.connect(trader1())
            .commitOrder({
              marketId: ethMarketId,
              accountId: 2,
              sizeDelta,
              settlementStrategyId: 0,
              acceptablePrice: bn(1050), // 5% slippage
              referrer: ethers.constants.AddressZero,
              trackingCode: ethers.constants.HashZero,
            });

          startTime = await getTxTime(provider(), tx);
        });

        it('calculates different fees using withPrice', async () => {
          let tentativePrice, tentativeOrderFees: BigNumberish, tentativeFeesPaidOnSettle;

          // same price
          tentativePrice = ethPrice;
          tentativeFeesPaidOnSettle = computeFees(
            wei(0),
            wei(sizeDelta),
            wei(tentativePrice),
            orderFees
          );
          [tentativeOrderFees] = await systems().PerpsMarket.computeOrderFeesWithPrice(
            ethMarketId,
            sizeDelta,
            tentativePrice
          );
          assertBn.equal(tentativeOrderFees, tentativeFeesPaidOnSettle.perpsMarketFee);

          // double price
          tentativePrice = ethPrice.mul(2);
          tentativeFeesPaidOnSettle = computeFees(
            wei(0),
            wei(sizeDelta),
            wei(tentativePrice),
            orderFees
          );
          [tentativeOrderFees] = await systems().PerpsMarket.computeOrderFeesWithPrice(
            ethMarketId,
            sizeDelta,
            tentativePrice
          );
          assertBn.equal(tentativeOrderFees, tentativeFeesPaidOnSettle.perpsMarketFee);

          // half price
          tentativePrice = ethPrice.div(2);
          tentativeFeesPaidOnSettle = computeFees(
            wei(0),
            wei(sizeDelta),
            wei(tentativePrice),
            orderFees
          );
          [tentativeOrderFees] = await systems().PerpsMarket.computeOrderFeesWithPrice(
            ethMarketId,
            sizeDelta,
            tentativePrice
          );
          assertBn.equal(tentativeOrderFees, tentativeFeesPaidOnSettle.perpsMarketFee);
        });

        it('returns proper fees on getOrderFees', async () => {
          const [orderFees] = await systems().PerpsMarket.computeOrderFees(ethMarketId, sizeDelta);
          assertBn.equal(orderFees, feesPaidOnSettle.perpsMarketFee);
        });

        it('validate that not fees are paid on commit', async () => {
          const { traderBalance, keeperBalance } = await getBalances();

          assertBn.equal(traderBalance, balancesBeforeLong.traderBalance);
          assertBn.equal(keeperBalance, balancesBeforeLong.keeperBalance);
        });

        const restoreToKeeper = snapshotCheckpoint(provider);

        describe('when settling the order', () => {
          before(restoreToKeeper);

          before('settle', async () => {
            const settlementTime = startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1;
            await fastForwardTo(settlementTime, provider());
            await settleOrder({
              systems,
              keeper: keeper(),
              accountId: 2,
              commitmentTime: startTime,
              offChainPrice: bn(1000),
            });
          });

          it('validate fees paid on settle', async () => {
            const { traderBalance, keeperBalance, traderDebt } = await getBalances();

            const { traderBalanceUsed, debt } = calculateDebtAndLeftover(
              testCase.availableUsdAmount,
              feesPaidOnSettle.totalFees
            );

            assertBn.equal(traderBalance, balancesBeforeLong.traderBalance.sub(traderBalanceUsed));
            assertBn.equal(traderDebt, debt);

            assertBn.equal(
              keeperBalance,
              balancesBeforeLong.keeperBalance.add(feesPaidOnSettle.keeperFee)
            );
          });
        });
      });

      describe('multiple orders ', () => {
        let feesPaidOnLong: Fees;

        let balancesAfterLong: {
          traderBalance: ethers.BigNumber;
          keeperBalance: ethers.BigNumber;
          accountPnl: ethers.BigNumber;
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
            wei(0),
            wei(initialLongSize),
            wei(await systems().PerpsMarket.fillPrice(ethMarketId, initialLongSize, ethPrice)),
            orderFees
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
          const { traderBalanceUsed, debt } = calculateDebtAndLeftover(
            testCase.availableUsdAmount,
            feesPaidOnLong.totalFees
          );

          const availableTraderBalance = balancesBeforeLong.traderBalance.sub(traderBalanceUsed);

          assertBn.equal(balancesAfterLong.traderBalance, availableTraderBalance);
          assertBn.equal(balancesAfterLong.traderDebt, debt);
          assertBn.equal(
            balancesAfterLong.keeperBalance,
            balancesBeforeLong.keeperBalance.add(feesPaidOnLong.keeperFee)
          );
        });

        const restoreToLongOrder = snapshotCheckpoint(provider);

        describe('reduce position size (maker)', () => {
          let feesPaidOnShort: Fees;
          const sizeDelta = bn(-1); // original size is 2, reduce by 1 => still long, but smaller

          before(restoreToLongOrder);

          before('open a small short order', async () => {
            feesPaidOnShort = computeFees(
              wei(initialLongSize),
              wei(sizeDelta),
              wei(await systems().PerpsMarket.fillPrice(ethMarketId, sizeDelta, ethPrice)),
              orderFees
            );

            await openPosition({
              ...commonOpenPositionProps,
              sizeDelta,
              price: ethPrice,
            });
          });

          it('validate fees paid on short position', async () => {
            const { traderBalance, keeperBalance } = await getBalances();

            const expectedTraderBalance = testCase.availableUsdAmount.gt(bn(2))
              ? balancesAfterLong.traderBalance.sub(feesPaidOnShort.totalFees)
              : balancesAfterLong.traderBalance;

            assertBn.equal(traderBalance, expectedTraderBalance);
            assertBn.equal(
              keeperBalance,
              balancesAfterLong.keeperBalance.add(feesPaidOnShort.keeperFee)
            );
          });
        });

        describe('flip the order side (maker + taker)', () => {
          let feesPaidOnShort: Fees;
          const sizeDelta = bn(-3); // original size is 2, reduce by 3 => flip to short -1

          before(restoreToLongOrder);

          before('open a large short order', async () => {
            feesPaidOnShort = computeFees(
              wei(initialLongSize),
              wei(sizeDelta),
              wei(await systems().PerpsMarket.fillPrice(ethMarketId, sizeDelta, ethPrice)),
              orderFees
            );

            await openPosition({
              ...commonOpenPositionProps,
              sizeDelta,
              price: ethPrice,
            });
          });

          it('validate fees paid', async () => {
            const { traderBalance, keeperBalance } = await getBalances();

            const expectedTraderBalance = testCase.availableUsdAmount.gt(bn(2))
              ? balancesAfterLong.traderBalance.sub(feesPaidOnShort.totalFees)
              : balancesAfterLong.traderBalance;

            assertBn.equal(traderBalance, expectedTraderBalance);
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
    const traderDebt = await systems().PerpsMarket.debt(2);
    const keeperBalance = await systems().USD.balanceOf(await keeper().getAddress());
    const accountPnl = (await systems().PerpsMarket.getOpenPosition(2, ethMarketId))[0];
    return {
      traderBalance,
      keeperBalance,
      accountPnl,
      traderDebt,
    };
  };
});

const calculateDebtAndLeftover = (
  availableUsdAmount: ethers.BigNumber,
  totalFees: ethers.BigNumber
) => {
  const leftoverUsd = availableUsdAmount.sub(totalFees);
  const traderBalanceUsed = leftoverUsd.gt(0) ? totalFees : availableUsdAmount;

  const hasSnxUsdToCoverFees = availableUsdAmount.gt(totalFees);

  return {
    traderBalanceUsed,
    debt: hasSnxUsdToCoverFees ? bn(0) : leftoverUsd.mul(-1),
  };
};
