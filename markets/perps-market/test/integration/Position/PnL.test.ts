import { DEFAULT_SETTLEMENT_STRATEGY, PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { depositCollateral, openPosition } from '../helpers';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

const SECONDS_IN_DAY = 24 * 60 * 60;

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

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
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
    { name: 'long', sice: bn(10), newPrice: bn(1000), marketPnL: bn(0), accountPnL: bn(0) },
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

          before('open position', async () => {});

          before('change price', async () => {});

          before('close position', async () => {});

          it('should have correct market PnL', async () => {});

          it('should have correct account PnL', async () => {});

          after(restorePnl);
        });
      });

      after(restoreCollateralCase);
    });
  });
});
