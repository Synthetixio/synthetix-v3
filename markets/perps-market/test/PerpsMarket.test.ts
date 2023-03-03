import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapPerpsMarket } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from '../generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe.only('perps test', () => {
  const { systems, signers, marketId, restore } = bootstrapTraders(
    bootstrapPerpsMarket('Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer, trader1: ethers.Signer, trader2: ethers.Signer;

  before('identify actors', async () => {
    [, , marketOwner, trader1, trader2] = signers();
  });

  before('create account', async () => {
    const [, , marketOwner, trader1] = signers();
    await systems().Core.connect(trader1).createAccount(2);
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

  before('commit order', async () => {
    const [, , , trader1] = signers();
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
