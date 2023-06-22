import { ContractTransaction, ethers } from 'ethers';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { bn, bootstrapMarkets } from '../bootstrap';
import { depositCollateral } from '../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/src/utils/assertions/assert-event';

describe('Cancel Offchain Async Order test', () => {
  const { systems, perpsMarkets, provider, trader1 } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
        maxMarketValue: bn(9999999),
      },
    ],
    traderAccountIds: [2, 3],
  });
  let ethMarketId: ethers.BigNumber;

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
  before('commit order', async () => {
    const tx = await systems().PerpsMarket.commitOrder({
      marketId: ethMarketId,
      accountId: 2,
      sizeDelta: bn(1),
      settlementStrategyId: 0,
      acceptablePrice: bn(1050), // 5% slippage
      trackingCode: ethers.constants.HashZero,
    });
    await tx.wait();
    assertBn.equal((await systems().PerpsMarket.getOrder(ethMarketId, 2)).sizeDelta, bn(1));
  });
  describe('errors', async () => {
    it('commit can not be canceled when settlement window is withing range', async () => {
      await assertRevert(
        systems().PerpsMarket.cancelOrder(ethMarketId, 2),
        `SettlementWindowNotExpired`,
        systems().PerpsMarket
      );
    });

    it('commit can not be canceled when its not existing', async () => {
      await assertRevert(
        systems().PerpsMarket.cancelOrder(ethMarketId, 3),
        'OrderNotValid()',
        systems().PerpsMarket
      );
    });
  });

  describe('success', async () => {
    let tx: ContractTransaction;
    before('fast forward outside of settlement window', async () => {
      await fastForwardTo((await getTime(provider())) + 9000000000, provider());
      tx = await systems().PerpsMarket.cancelOrder(ethMarketId, 2);
    });
    it('emits event when order is canceled', async () => {
      // Ignore settlement time and price for the event
      await assertEvent(tx, `OrderCanceled(1, 2,`, systems().PerpsMarket);
    });
    it('sizeDelta is 0 when order is canceled', async () => {
      const orderAfterCancelation = await systems().PerpsMarket.getOrder(ethMarketId, 2);
      assertBn.equal(orderAfterCancelation.sizeDelta, bn(0));
    });
  });
});
