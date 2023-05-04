import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import { SynthRouter } from './generated/typechain';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

describe('Atomic Orders Utilization Rate tests', () => {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: Ethers.Signer, trader1: Ethers.Signer, trader2: Ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, trader1, trader2] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  before('approve max', async () => {
    await systems()
      .USD.connect(trader1)
      .approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await synth.connect(trader1).approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await systems()
      .USD.connect(trader2)
      .approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await synth.connect(trader2).approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
  });

  before('set utilization rate fee', async () => {
    await systems().SpotMarket.connect(marketOwner).setMarketUtilizationFees(marketId(), bn(0.001));
  });

  const restore = snapshotCheckpoint(provider);

  // assumption: delegated collateral = $100,000

  describe('with 1x leverage', () => {
    before('set collateral leverage to 1', async () => {
      await systems().SpotMarket.connect(marketOwner).setCollateralLeverage(marketId(), bn(1));
    });

    // utilization rate from 0-90%
    before('buy 90 eth', async () => {
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(90_000), bn(90), Ethers.constants.AddressZero);
    });

    it('sent 90 snxETH to trader', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(90));
    });

    describe('trader2 buys 20 eth', () => {
      // utilization rate from 90-110%
      // utilization 5% above util * 0.1% = 0.5% fee
      before(async () => {
        await systems()
          .SpotMarket.connect(trader2)
          .buy(marketId(), bn(20_000), bn(19.9), Ethers.constants.AddressZero);
      });

      it('sent less than 19.9 snx ETH to trader', async () => {
        // 20 * 0.5% =
        assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(19.9));
      });
    });
  });

  describe('with 2x leverage', () => {
    before(restore);
    // with 2x leverage, delegated collateral is 2x == $200,000
    before('set collateral leverage to 1', async () => {
      await systems().SpotMarket.connect(marketOwner).setCollateralLeverage(marketId(), bn(2));
    });

    // utilization rate from 0-90%
    before('buy 150 eth', async () => {
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(150_000), bn(150), Ethers.constants.AddressZero);
    });

    it('sent 150 snxETH to trader', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(150));
    });

    describe('trader2 buys 60 eth', () => {
      // utilization 2.5% above util * 0.1% = 0.25% fee
      before(async () => {
        await systems()
          .SpotMarket.connect(trader2)
          .buy(marketId(), bn(60_000), bn(59.85), Ethers.constants.AddressZero);
      });

      it('sent less than 60 snxETH to trader', async () => {
        //
        assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(59.85));
      });
    });
  });
});
