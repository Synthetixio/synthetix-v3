import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { ethers } from 'ethers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

/**
 * This test is used to profile the gas consumption of liquidations.
 * @dev This test is not meant to be run in CI, it is only used to profile gas consumption.
 * @dev To run this test, replace the `skip` for `only` and run `REPORT_GAS=true yarn test`.
 */
describe.skip('Gas profiling - Liquidation', async () => {
  const PRICE = bn(1_000);
  const MARKETS_QUANTITY = 100;
  const TOTAL_POSITIONS_SIZE = 10;
  const generateFakeMarketConfigs = (quantity: number) => {
    return Array.from({ length: quantity }, (_, i) => ({
      requestedMarketId: 50 + i,
      name: 'FakeMarket' + i,
      token: 'FAKE' + i,
      price: PRICE,
      fundingParams: { skewScale: bn(100), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.001),
        maintenanceMarginScalar: bn(0.05),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.01),
        maxSecondsInLiquidationWindow: bn(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    }));
  };

  const getPositionSizes = (quantity: number) => {
    return Array.from({ length: quantity }, () => {
      return bn(TOTAL_POSITIONS_SIZE / quantity);
    }).concat(
      Array.from({ length: MARKETS_QUANTITY - quantity }, () => {
        return bn(0);
      })
    );
  };

  const perpsMarketConfigs = generateFakeMarketConfigs(MARKETS_QUANTITY);

  const { systems, provider, trader1, synthMarkets, keeper, superMarketId, perpsMarkets } =
    bootstrapMarkets({
      liquidationGuards: {
        minLiquidationReward: bn(1),
        maxLiquidationReward: bn(100),
      },
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'snxBTC',
          buyPrice: bn(30_000),
          sellPrice: bn(30_000),
        },
        {
          name: 'Ethereum',
          token: 'snxETH',
          buyPrice: bn(2000),
          sellPrice: bn(2000),
        },
      ],
      perpsMarkets: perpsMarketConfigs,
      traderAccountIds: [2],
    });

  let btcSynth: SynthMarkets[number], ethSynth: SynthMarkets[number];

  before('identify actors', async () => {
    btcSynth = synthMarkets()[0];
    ethSynth = synthMarkets()[1];
  });

  before('get gas helper', async () => {
    await systems()
      .MockGasProfiler.connect(trader1())
      .setPerpsMarketFactory(systems().PerpsMarket.address);
  });

  before('add collateral to margin', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 2,
      collaterals: [
        {
          synthMarket: () => btcSynth,
          snxUSDAmount: () => bn(2000),
        },
        {
          synthMarket: () => ethSynth,
          snxUSDAmount: () => bn(2000),
        },
      ],
    });
  });

  let commonOpenPositionProps: Pick<
    OpenPositionData,
    'systems' | 'provider' | 'trader' | 'accountId' | 'keeper' | 'price'
  >;
  before('identify common props', async () => {
    commonOpenPositionProps = {
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      price: PRICE,
    };
  });

  const restoreToOpenPositions = snapshotCheckpoint(provider);

  let positionSizes: () => ethers.BigNumber[];

  [1, 2, 5, 10, 50, 100].forEach((quantity) => {
    describe(`Liquidation of ${quantity} positions`, () => {
      before('open positions', async () => {
        positionSizes = () => getPositionSizes(quantity);
        for (const [i, perpsMarket] of perpsMarkets().entries()) {
          if (positionSizes()[i].isZero()) continue;

          await openPosition({
            ...commonOpenPositionProps,
            marketId: perpsMarket.marketId(),
            sizeDelta: positionSizes()[i],
            settlementStrategyId: perpsMarket.strategyId(),
          });
        }
      });

      it('should have correct positions', async () => {
        for (const [i, perpsMarket] of perpsMarkets().entries()) {
          const [, , positionSize] = await systems().PerpsMarket.getOpenPosition(
            2,
            perpsMarket.marketId()
          );
          assertBn.equal(positionSize, positionSizes()[i]);
        }
      });

      it('should show market debt', async () => {
        await systems().MockGasProfiler.connect(trader1()).txReportedDebt(superMarketId());
        const gasUsedByTx = await systems().MockGasProfiler.gasUsed();
        console.log('Gas used by reportedDebt(): ', gasUsedByTx);
        assertBn.gt(gasUsedByTx, 0);
      });

      it('should show minimum Credit', async () => {
        await systems().MockGasProfiler.connect(trader1()).txMinimumCredit(superMarketId());
        const gasUsedByTx = await systems().MockGasProfiler.gasUsed();
        console.log('Gas used by minimumCredit(): ', gasUsedByTx);
        assertBn.gt(gasUsedByTx, 0);

        // const minimumCredit = await systems().PerpsMarket.minimumCredit(superMarketId());
        // assertBn.equal(minimumCredit, 0);
      });

      describe('liquidate', async () => {
        before('change perps token price', async () => {
          for (const [, perpsMarket] of perpsMarkets().entries()) {
            await perpsMarket.aggregator().mockSetCurrentPrice(bn(200));
          }
        });

        before('liquidate account', async () => {
          await systems().PerpsMarket.connect(keeper()).liquidate(2);
        });

        it('empties account margin', async () => {
          assertBn.equal(await systems().PerpsMarket.totalCollateralValue(2), 0);
        });

        it('empties open interest', async () => {
          assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), 0);
        });
      });

      after(restoreToOpenPositions);
    });
  });
});
