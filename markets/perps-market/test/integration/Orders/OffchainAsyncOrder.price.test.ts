import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets, toNum } from '../bootstrap';
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
  let extraData: string;

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
  });

  before('add collateral', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 2,
      collaterals: [
        {
          snxUSDAmount: () => bn(10_000),
        },
      ],
    });
  });

  before('setup bytes data', () => {
    extraData = ethers.utils.defaultAbiCoder.encode(['uint128'], [2]);
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
        let updateFee: ethers.BigNumber;
        let startTime: number;

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
          startTime = await getTxTime(provider(), tx);

          // fast forward to settlement
          await fastForwardTo(
            startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
            provider()
          );
        });

        const restoreToSettleTime = snapshotCheckpoint(provider);

        describe('price at max limit', () => {
          let validPythPriceData: string, updateFee: ethers.BigNumber;
          before(restoreToSettleTime);

          before('set test price', async () => {
            validPythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
              DEFAULT_SETTLEMENT_STRATEGY.feedId,
              1000_0000,
              1,
              -4,
              1000_0000,
              1,
              startTime + 6
            );
            updateFee = await systems().MockPyth['getUpdateFee(uint256)'](1);
          });

          before('settles the order', async () => {
            await systems()
              .PerpsMarket.connect(keeper())
              .settlePythOrder(validPythPriceData, extraData, { value: updateFee });
          });

          it('check position is live', async () => {
            const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
            assertBn.equal(size, iter.sizeDelta);
          });
        });

        describe('price at min limit', () => {
          let validPythPriceData: string, updateFee: ethers.BigNumber;
          before(restoreToSettleTime);

          before('set test price', async () => {
            validPythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
              DEFAULT_SETTLEMENT_STRATEGY.feedId,
              1000_0000,
              1,
              -4,
              1000_0000,
              1,
              startTime + 6
            );
            updateFee = await systems().MockPyth['getUpdateFee(uint256)'](1);
          });

          before('settles the order', async () => {
            await systems()
              .PerpsMarket.connect(keeper())
              .settlePythOrder(validPythPriceData, extraData, { value: updateFee });
          });

          it('check position is live', async () => {
            const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
            assertBn.equal(size, iter.sizeDelta);
          });
        });
      });

      describe('fillPrice deviation check at commit', () => {
        describe('when fillPrice is not acceptable', () => {
          before(restoreToSetCollateralTime);

          it('reverts', async () => {
            await assertRevert(
              systems().PerpsMarket.connect(trader1()).commitOrder({
                marketId: ethMarketId,
                accountId: 2,
                sizeDelta: iter.sizeDelta,
                settlementStrategyId: 0,
                acceptablePrice: iter.tightFillPrice,
                referrer: ethers.constants.AddressZero,
                trackingCode: ethers.constants.HashZero,
              }),
              `AcceptablePriceExceeded("${iter.limitFillPrice}", "${iter.tightFillPrice}")`
            );
          });
        });

        describe('when fillPrice is acceptable', () => {
          let validPythPriceData: string, updateFee: ethers.BigNumber;
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
            const startTime = await getTxTime(provider(), tx);

            // fast forward to settlement
            await fastForwardTo(
              startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
              provider()
            );

            validPythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
              DEFAULT_SETTLEMENT_STRATEGY.feedId,
              1000_0000,
              1,
              -4,
              1000_0000,
              1,
              startTime + 6
            );
            updateFee = await systems().MockPyth['getUpdateFee(uint256)'](1);
          });

          before('settles the order', async () => {
            await systems()
              .PerpsMarket.connect(keeper())
              .settlePythOrder(validPythPriceData, extraData, { value: updateFee });
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
