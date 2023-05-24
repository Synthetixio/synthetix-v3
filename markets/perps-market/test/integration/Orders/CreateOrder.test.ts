import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

describe('Create Order test', () => {
  const { systems, signers, perpsMarkets, provider, trader1 } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: bn(1000) }],
    traderAccountIds: [2, 3],
  });

  let marketOwner: ethers.Signer, marketId: ethers.BigNumber;

  before('identify actors', async () => {
    [, , marketOwner] = signers();
    marketId = perpsMarkets()[0].marketId();
  });

  before('create settlement strategy', async () => {
    await systems()
      .PerpsMarket.connect(marketOwner)
      .addSettlementStrategy(marketId, {
        strategyType: 0,
        settlementDelay: 5,
        settlementWindowDuration: 120,
        priceVerificationContract: ethers.constants.AddressZero,
        feedId: ethers.constants.HashZero,
        url: '',
        disabled: false,
        settlementReward: bn(5),
        priceDeviationTolerance: bn(0.01),
      });
  });

  before('set skew scale', async () => {
    await systems().PerpsMarket.connect(marketOwner).setSkewScale(marketId, bn(100_000));
  });

  before('add collateral', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000));
  });

  before('commit order', async () => {
    await systems()
      .PerpsMarket.connect(trader1())
      .commitOrder({
        marketId: marketId,
        accountId: 2,
        sizeDelta: bn(1),
        settlementStrategyId: 0,
        acceptablePrice: bn(1000),
        trackingCode: ethers.constants.HashZero,
      });
    // fast forward to settlement
    await fastForwardTo((await getTime(provider())) + 6, provider());
  });

  before('settle', async () => {
    await systems().PerpsMarket.connect(trader1()).settle(marketId, 2);
  });

  it('check position is live', async () => {
    const [pnl, funding, size] = await systems().PerpsMarket.openPosition(2, marketId);
    assertBn.equal(pnl, bn(-0.005));
    assertBn.equal(funding, bn(0));
    assertBn.equal(size, bn(1));
  });
});
