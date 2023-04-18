import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapPerpsMarket } from './bootstrap';

describe('perps test', () => {
  const { systems, signers, marketId } = bootstrapTraders(bootstrapPerpsMarket('Ether', 'snxETH'));

  let marketOwner: ethers.Signer, trader1: ethers.Signer;

  before('identify actors', async () => {
    [, , marketOwner, trader1] = signers();
  });

  before('create account', async () => {
    const [, , , trader1] = signers();
    console.log(systems().PerpsMarket.connect(trader1));
    await systems().PerpsMarket.connect(trader1)['createAccount(uint128)'](2);
  });

  before('create settlement strategy', async () => {
    await systems()
      .PerpsMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), {
        strategyType: 0,
        settlementDelay: 5,
        settlementWindowDuration: 120,
        priceVerificationContract: ethers.constants.AddressZero,
        feedId: ethers.constants.HashZero,
        url: '',
        settlementReward: bn(5),
        priceDeviationTolerance: bn(0.01),
      });
  });

  before('set skew scale', async () => {
    await systems().PerpsMarket.connect(marketOwner).setSkewScale(marketId(), bn(100_000));
  });

  before('add collateral', async () => {
    await systems().PerpsMarket.connect(trader1).modifyCollateral(2, 0, bn(10_000));
  });

  before('commit order', async () => {
    await systems()
      .PerpsMarket.connect(trader1)
      .commitOrder({
        marketId: marketId(),
        accountId: 2,
        sizeDelta: bn(1),
        settlementStrategyId: 0,
        acceptablePrice: bn(900),
        trackingCode: ethers.constants.HashZero,
      });
  });

  it('works', () => {
    console.log(systems().PerpsMarket);
  });
});
