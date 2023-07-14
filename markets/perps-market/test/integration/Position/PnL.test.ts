import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
// import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Position - pnl', () => {
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
        // setting to 0 to avoid funding and p/d price change affecting pnl
        fundingParams: { skewScale: bn(0), maxFundingVelocity: bn(0) },
        orderFees,
      },
    ],
    traderAccountIds: [2, 3],
  });

  let ethMarketId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];
  let perpsMarket: PerpsMarket;

  before('identify actors', async () => {
    perpsMarket = perpsMarkets()[0];
    ethMarketId = perpsMarket.marketId();
    btcSynth = synthMarkets()[0];
  });

  const collateralTestCases = [
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

  const pnlTestCases = [
    { name: 'long', sizeDelta: bn(10), newPrice: bn(1000) },
    { name: 'short', sizeDelta: bn(-10), newPrice: bn(1000) },
  ];

  collateralTestCases.forEach((testCase) => {
    describe(`Using ${testCase.name} as collateral`, () => {
      const restoreCollateralCase = snapshotCheckpoint(provider);

      before('add collateral', async () => {
        await depositCollateral(testCase.collateralData);
      });

      pnlTestCases.forEach((pnlTestCase) => {
        describe(`PnL for ${pnlTestCase.name} position`, () => {
          const restorePnl = snapshotCheckpoint(provider);

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

          let balancesBefore: {
            traderBalance: ethers.BigNumber;
            perpMarketWithdrawable: ethers.BigNumber;
            keeperBalance: ethers.BigNumber;
          };

          let balancesAfter: {
            traderBalance: ethers.BigNumber;
            perpMarketWithdrawable: ethers.BigNumber;
            keeperBalance: ethers.BigNumber;
          };

          before('identify common props', async () => {
            commonOpenPositionProps = {
              systems,
              provider,
              trader: testCase.collateralData.trader(),
              accountId: 2,
              marketId: ethMarketId,
              settlementStrategyId: perpsMarket.strategyId(),
              keeper: keeper(),
            };
          });

          before('collect initial stats', async () => {
            balancesBefore = await getBalances();
          });

          before('open position', async () => {
            await openPosition({
              ...commonOpenPositionProps,
              sizeDelta: pnlTestCase.sizeDelta,
              price: ethPrice,
            });
          });

          before('change price', async () => {
            await perpsMarket.aggregator().mockSetCurrentPrice(pnlTestCase.newPrice);
          });

          before('close position', async () => {
            await openPosition({
              ...commonOpenPositionProps,
              sizeDelta: pnlTestCase.sizeDelta.mul(-1),
              price: pnlTestCase.newPrice,
            });
          });

          before('collect final stats', async () => {
            balancesAfter = await getBalances();
          });

          it('should have correct market PnL', async () => {
            console.log('balancesBefore', balancesBefore);
            console.log('balancesAfter', balancesAfter);
          });

          it('should have correct account PnL', async () => {});

          after(restorePnl);
        });
      });

      after(restoreCollateralCase);
    });
  });
  const getBalances = async () => {
    const traderBalance = await systems().PerpsMarket.totalCollateralValue(2);
    const perpMarketWithdrawable = await systems().Core.getWithdrawableMarketUsd(ethMarketId);
    const keeperBalance = await systems().USD.balanceOf(keeper().getAddress());
    const accountPnl = (await systems().PerpsMarket.getOpenPosition(2, ethMarketId))[0];
    return {
      traderBalance,
      perpMarketWithdrawable,
      keeperBalance,
      accountPnl,
    };
  };
});
