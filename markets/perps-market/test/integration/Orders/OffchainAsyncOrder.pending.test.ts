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
import { calculateFillPrice } from '../helpers/fillPrice';
import { wei } from '@synthetixio/wei';
import { calcCurrentFundingVelocity } from '../helpers/funding-calcs';

describe('Offchain Async Order - Prevent updates with pending order test', () => {
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
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
      },
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        price: bn(10_000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
      },
    ],
    traderAccountIds: [2, 3],
  });
  let ethMarketId: ethers.BigNumber;
  let btcMarketId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    btcMarketId = perpsMarkets()[1].marketId();
    btcSynth = synthMarkets()[0];
  });

  describe('With a pending order', () => {
    let startTime: number;
    let extraData: string;
    let pythCallData: string;
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

    before('commit the order', async () => {
      const tx = await systems()
        .PerpsMarket.connect(trader1())
        .commitOrder({
          marketId: ethMarketId,
          accountId: 2,
          sizeDelta: bn(1),
          settlementStrategyId: 0,
          acceptablePrice: bn(1050), // 5% slippage
          trackingCode: ethers.constants.HashZero,
        });
      startTime = await getTxTime(provider(), tx);
    });

    before('setup bytes data', () => {
      extraData = ethers.utils.defaultAbiCoder.encode(['uint128', 'uint128'], [ethMarketId, 2]);
      pythCallData = ethers.utils.solidityPack(
        ['bytes32', 'uint64'],
        [
          DEFAULT_SETTLEMENT_STRATEGY.feedId,
          startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay,
        ]
      );
    });

    const restoreToCommit = snapshotCheckpoint(provider);

    describe('failures', () => {
      before(restoreToCommit);

      it('reverts if attempt to update collateral', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10)),
          'PendingOrdersExist()',
          systems().PerpsMarket
        );
      });

      it('reverts if attempt to commit another order', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(trader1())
            .commitOrder({
              marketId: btcMarketId,
              accountId: 2,
              sizeDelta: bn(0.01),
              settlementStrategyId: 0,
              acceptablePrice: bn(10050), // 5% slippage
              trackingCode: ethers.constants.HashZero,
            }),
          'PendingOrdersExist()',
          systems().PerpsMarket
        );
      });
    });

    describe('after settle the pending order', () => {
      before(restoreToCommit);
      before('settle the order', async () => {});
      it('can update the collateral', async () => {
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10));
      });

      it('can commit another order', async () => {
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: btcMarketId,
            accountId: 2,
            sizeDelta: bn(0.01),
            settlementStrategyId: 0,
            acceptablePrice: bn(10050), // 5% slippage
            trackingCode: ethers.constants.HashZero,
          });
      });
    });

    describe('after cancel the pending order', () => {
      before(restoreToCommit);
      before('cancel the order', async () => {});
      it('can update the collateral', async () => {
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10));
      });

      it('can commit another order', async () => {
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: btcMarketId,
            accountId: 2,
            sizeDelta: bn(0.01),
            settlementStrategyId: 0,
            acceptablePrice: bn(10050), // 5% slippage
            trackingCode: ethers.constants.HashZero,
          });
      });
    });
  });
});
