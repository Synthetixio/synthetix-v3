import { ethers } from 'ethers';
import { fastForward } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { bn, bootstrapMarkets } from '../bootstrap';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { depositCollateral } from '../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';

describe.only('Cancel Offchain Async Order test', () => {
  const { systems, perpsMarkets, synthMarkets, provider, trader1 } = bootstrapMarkets({
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
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      },
    ],
    traderAccountIds: [2, 3],
  });
  let ethMarketId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];
  let startTime: number = 10_0000;

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    btcSynth = synthMarkets()[0];
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

  before('commit async order', async () => {
    systems()
      .PerpsMarket.connect(trader1())
      .commitOrder({
        marketId: ethMarketId,
        accountId: 2,
        sizeDelta: bn(1),
        settlementStrategyId: 0,
        acceptablePrice: bn(1000),
        trackingCode: ethers.constants.HashZero,
      });
  });

  it('commit can not be canceled when settlement window is withing range', async () => {
    fastForward(2, provider());
    await assertRevert(
      systems().PerpsMarket.cancelOrder(ethMarketId, 2),
      `SettlementWindowNotExpired`,
      systems().PerpsMarket
    );
  });

  it('commit can be canceled when settlement window is outside of range', async () => {
    fastForward(900000, provider());
    const orderBeforeCancelation = await systems().PerpsMarket.getOrder(ethMarketId, 2);
    assertBn.equal(orderBeforeCancelation.sizeDelta, bn(1));
    await systems().PerpsMarket.cancelOrder(ethMarketId, 2);
    const orderAfterCancelation = await systems().PerpsMarket.getOrder(ethMarketId, 2);
    assertBn.equal(orderAfterCancelation.sizeDelta, bn(0));
  });
});
