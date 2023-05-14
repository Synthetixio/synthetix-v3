import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapPerpsMarkets, bootstrapMarkets } from '../bootstrap';
import { bootstrapSynthMarkets } from '@synthetixio/spot-market/test/common';

describe('ModifyCollateral', () => {
  const accountIds = [10, 20];
  const { systems, owner, synthMarkets, trader1 } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(10000),
        sellPrice: bn(10000),
      },
    ],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: bn(1000) }],
    traderAccountIds: accountIds,
  });

  let snxBTCMarketId: ethers.BigNumber;

  before('identify actors', () => {
    snxBTCMarketId = synthMarkets()[0].marketId();
  });

  // TODO: test this limit
  before('set snxBTC limit to max', async () => {
    // set max collateral amt for snxUSD to maxUINT
    await systems()
      .PerpsMarket.connect(owner())
      .setMaxCollateralAmount(snxBTCMarketId, ethers.constants.MaxUint256);
  });

  before('trader1 buys 1 snxBTC', async () => {
    await systems()
      .SpotMarket.connect(trader1())
      .buy(snxBTCMarketId, bn(10000), bn(1), ethers.constants.AddressZero);
  });

  before('add collateral', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(accountIds[0], 0, bn(10_000));
    await synthMarkets()[0]
      .synth()
      .connect(trader1())
      .approve(systems().PerpsMarket.address, bn(1));
    await systems()
      .PerpsMarket.connect(trader1())
      .modifyCollateral(accountIds[0], snxBTCMarketId, bn(1));
  });

  it('properly reflects margin for account', async () => {
    const totalValue = await systems().PerpsMarket.totalCollateralValue(accountIds[0]);
    console.log(totalValue);
  });
});
