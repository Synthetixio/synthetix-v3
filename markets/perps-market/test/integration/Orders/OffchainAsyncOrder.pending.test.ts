import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { depositCollateral, settleOrder } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';

describe('Offchain Async Order - Prevent updates with pending order test', () => {
  const { systems, perpsMarkets, provider, trader1, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
      },
      {
        requestedMarketId: 30,
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

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    btcMarketId = perpsMarkets()[1].marketId();
  });

  describe('With a pending order', () => {
    let startTime: number;
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
          referrer: ethers.constants.AddressZero,
          trackingCode: ethers.constants.HashZero,
        });
      startTime = await getTxTime(provider(), tx);
    });

    const restoreToCommit = snapshotCheckpoint(provider);

    describe('failures', () => {
      before(restoreToCommit);

      it('reverts if attempt to update collateral', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10)),
          'PendingOrderExists()',
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
              referrer: ethers.constants.AddressZero,
              trackingCode: ethers.constants.HashZero,
            }),
          'PendingOrderExists()',
          systems().PerpsMarket
        );
      });
    });

    describe('after settle the pending order', () => {
      before(restoreToCommit);

      before('settle the order', async () => {
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

      it('can update the collateral', async () => {
        const collateralBalancBefore = await systems().PerpsMarket.getCollateralAmount(2, 0);

        await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10));

        const collateralBalancAfter = await systems().PerpsMarket.getCollateralAmount(2, 0);
        assertBn.equal(collateralBalancAfter, collateralBalancBefore.add(bn(10)));
      });

      it('can commit another order', async () => {
        await systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: btcMarketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(10050), // 5% slippage
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          });

        const order = await systems().PerpsMarket.getOrder(2);
        assertBn.equal(order.request.accountId, 2);
        assertBn.equal(order.request.marketId, btcMarketId);
        assertBn.equal(order.request.sizeDelta, bn(1));
      });
    });

    describe('after expiration of current order', () => {
      before(restoreToCommit);

      before(async () => {
        await fastForwardTo(
          startTime +
            DEFAULT_SETTLEMENT_STRATEGY.settlementDelay +
            DEFAULT_SETTLEMENT_STRATEGY.settlementWindowDuration +
            1,
          provider()
        );
        // await systems().PerpsMarket.cancelOrder(ethMarketId, 2);
      });

      it('can update the collateral', async () => {
        const collateralBalancBefore = await systems().PerpsMarket.getCollateralAmount(2, 0);

        await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10));

        const collateralBalancAfter = await systems().PerpsMarket.getCollateralAmount(2, 0);
        assertBn.equal(collateralBalancAfter, collateralBalancBefore.add(bn(10)));
      });

      it('can commit another order', async () => {
        await systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: btcMarketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(10050), // 5% slippage
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          });

        const order = await systems().PerpsMarket.getOrder(2);
        assertBn.equal(order.request.accountId, 2);
        assertBn.equal(order.request.marketId, btcMarketId);
        assertBn.equal(order.request.sizeDelta, bn(1));
      });
    });
  });
});
